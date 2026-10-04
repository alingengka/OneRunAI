-- Remembers finished transcriptions so the same audio (same user, language and
-- glossary) is never sent to the AI engines twice. Only the server writes or
-- reads it, with the service role; RLS stays on with no policies.
create table public.transcription_cache (
  key text primary key,                      -- sha256 of user + language + glossary + audio
  user_id uuid not null references auth.users (id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index transcription_cache_created_at_idx on public.transcription_cache (created_at);

alter table public.transcription_cache enable row level security;
