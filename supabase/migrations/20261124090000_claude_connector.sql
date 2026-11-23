-- Claude connector (MCP): audio uploaded by Claude and the subtitle jobs made
-- from it. Only the server (service role) reads or writes these.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'connector-audio',
  'connector-audio',
  false,
  157286400, -- 150 MB, about 80 minutes of 16 kHz mono WAV
  array['audio/wav', 'audio/x-wav', 'audio/wave', 'application/octet-stream']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.connector_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  audio_path text not null,
  state jsonb not null,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  error text,
  -- one request works on a job at a time
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists connector_jobs_user_created on public.connector_jobs (user_id, created_at desc);

alter table public.connector_jobs enable row level security;
-- no policies: only the service role reaches this table
