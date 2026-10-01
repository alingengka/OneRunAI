-- Accounts, 5-day free trial, AI-minute quotas, subscriptions paid by
-- QR transfer + slip upload (approved by an admin), and promo codes.
--
-- All money is whole KIP. All quotas are seconds of audio sent to AI.

-- ---------------------------------------------------------------------------
-- Plans (editable without code changes)
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key,                       -- 'trial' | 'monthly' | 'yearly'
  name text not null,
  price_kip integer not null default 0,
  duration_days integer not null,
  -- trial: total seconds for the whole trial; paid: seconds per calendar month
  quota_seconds integer not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

insert into public.plans (id, name, price_kip, duration_days, quota_seconds, sort_order) values
  ('trial',   'ทดลองใช้ฟรี', 0,        5,   30 * 60,  0),
  ('monthly', 'รายเดือน',     199000,   30,  300 * 60, 1),
  ('yearly',  'รายปี',        1990000,  365, 300 * 60, 2);

-- ---------------------------------------------------------------------------
-- Promo codes: a fixed price per plan while the code is valid
-- ---------------------------------------------------------------------------
create table public.promo_codes (
  code text primary key check (code = upper(code)),
  monthly_price_kip integer,
  yearly_price_kip integer,
  expires_at timestamptz,
  max_uses integer,                          -- null = unlimited
  used_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.promo_codes (code, monthly_price_kip, yearly_price_kip) values
  ('ONERUN', 99000, 990000);

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created by trigger)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  trial_ends_at timestamptz not null default (now() + interval '5 days'),
  plan text references public.plans (id),
  paid_until timestamptz,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trial_days integer;
begin
  select duration_days into trial_days from public.plans where id = 'trial';
  insert into public.profiles (id, email, trial_ends_at)
  values (new.id, new.email, now() + make_interval(days => coalesce(trial_days, 5)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- AI usage ledger (negative rows are refunds for failed calls)
-- ---------------------------------------------------------------------------
create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  seconds numeric(10, 2) not null,
  kind text not null,
  created_at timestamptz not null default now()
);
create index usage_events_user_time on public.usage_events (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Payments (QR transfer + slip)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null references public.plans (id),
  promo_code text references public.promo_codes (code),
  amount_kip integer not null,
  slip_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id)
);
create index payments_status_time on public.payments (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Site settings shown on the payment page (single row)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id integer primary key default 1 check (id = 1),
  payment_qr_url text,
  bank_name text,
  account_name text,
  account_number text,
  contact text,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Row level security: users read their own rows; every write goes through
-- server functions using the service role.
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.promo_codes enable row level security;
alter table public.profiles enable row level security;
alter table public.usage_events enable row level security;
alter table public.payments enable row level security;
alter table public.app_settings enable row level security;

create policy "plans readable" on public.plans for select to anon, authenticated using (active);
create policy "settings readable" on public.app_settings for select to anon, authenticated using (true);
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own usage" on public.usage_events for select to authenticated using (user_id = auth.uid());
create policy "own payments" on public.payments for select to authenticated using (user_id = auth.uid());
-- promo_codes: no policy, so codes cannot be listed from the browser.

-- ---------------------------------------------------------------------------
-- Access + quota
-- ---------------------------------------------------------------------------

-- Current access state for a user.
create or replace function public.account_status(uid uuid)
returns table (
  status text,                 -- 'paid' | 'trial' | 'expired'
  plan text,
  ends_at timestamptz,
  quota_seconds integer,
  used_seconds numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.profiles;
  window_start timestamptz;
begin
  select * into p from public.profiles where id = uid;
  if not found then
    return query select 'expired'::text, null::text, null::timestamptz, 0, 0::numeric;
    return;
  end if;

  if p.paid_until is not null and p.paid_until > now() then
    -- Paid quota resets every calendar month (Vientiane time) and on each
    -- approved payment, so trial usage never eats into a new subscription.
    window_start := greatest(
      date_trunc('month', now() at time zone 'Asia/Vientiane') at time zone 'Asia/Vientiane',
      coalesce((select max(pay.reviewed_at) from public.payments pay
        where pay.user_id = uid and pay.status = 'approved'), '-infinity'::timestamptz)
    );
    return query
      select 'paid'::text, p.plan, p.paid_until,
        (select pl.quota_seconds from public.plans pl where pl.id = coalesce(p.plan, 'monthly')),
        coalesce((select sum(u.seconds) from public.usage_events u
          where u.user_id = uid and u.created_at >= window_start), 0);
  elsif p.trial_ends_at > now() then
    return query
      select 'trial'::text, 'trial'::text, p.trial_ends_at,
        (select pl.quota_seconds from public.plans pl where pl.id = 'trial'),
        coalesce((select sum(u.seconds) from public.usage_events u where u.user_id = uid), 0);
  else
    return query select 'expired'::text, p.plan, coalesce(p.paid_until, p.trial_ends_at), 0, 0::numeric;
  end if;
end;
$$;

-- Atomically reserve AI seconds; raises when the account has no access or not
-- enough quota left. Returns the id of the usage row (for refunds).
create or replace function public.consume_ai_seconds(uid uuid, secs numeric, usage_kind text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  new_id bigint;
begin
  -- Serialise concurrent requests from the same user.
  perform 1 from public.profiles where id = uid for update;
  select * into s from public.account_status(uid);
  if s.status = 'expired' then
    raise exception 'ACCESS_EXPIRED';
  end if;
  if secs > 0 and s.used_seconds + secs > s.quota_seconds then
    raise exception 'QUOTA_EXCEEDED';
  end if;
  insert into public.usage_events (user_id, seconds, kind) values (uid, secs, usage_kind)
  returning id into new_id;
  return new_id;
end;
$$;

-- Approve a pending payment and extend the subscription.
create or replace function public.approve_payment(payment_id uuid, admin_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.payments;
  days integer;
begin
  select * into pay from public.payments where id = payment_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if pay.status <> 'pending' then raise exception 'PAYMENT_NOT_PENDING'; end if;

  select duration_days into days from public.plans where id = pay.plan;

  update public.payments
    set status = 'approved', reviewed_at = now(), reviewed_by = admin_id
    where id = payment_id;

  update public.profiles
    set plan = pay.plan,
        paid_until = greatest(coalesce(paid_until, now()), now()) + make_interval(days => days)
    where id = pay.user_id;

  if pay.promo_code is not null then
    update public.promo_codes set used_count = used_count + 1 where code = pay.promo_code;
  end if;
end;
$$;

revoke all on function public.account_status(uuid) from public, anon, authenticated;
revoke all on function public.consume_ai_seconds(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.approve_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.account_status(uuid) to service_role;
grant execute on function public.consume_ai_seconds(uuid, numeric, text) to service_role;
grant execute on function public.approve_payment(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('broll-assets', 'broll-assets', false),
  ('payment-slips', 'payment-slips', false),
  ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

-- B-roll: signed-in users only, each in their own folder.
drop policy if exists "broll assets readable" on storage.objects;
drop policy if exists "broll assets uploadable" on storage.objects;
drop policy if exists "broll own read" on storage.objects;
drop policy if exists "broll own upload" on storage.objects;
drop policy if exists "slip own read" on storage.objects;
drop policy if exists "slip own upload" on storage.objects;
create policy "broll own read" on storage.objects for select to authenticated
  using (bucket_id = 'broll-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "broll own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'broll-assets' and (storage.foldername(name))[1] = auth.uid()::text);

-- Payment slips: users upload/read their own; admins read via service role.
create policy "slip own read" on storage.objects for select to authenticated
  using (bucket_id = 'payment-slips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "slip own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-slips' and (storage.foldername(name))[1] = auth.uid()::text);
-- site-assets is public-read; uploads happen through the service role only.
