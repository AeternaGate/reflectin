create table public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  first_name text not null default '',
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  telegram_channel_id bigint,
  title text not null default '',
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null,
  content text not null,
  rubric text not null default 'польза',
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.generation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  feature text not null default 'post',
  model text not null,
  created_at timestamptz not null default now()
);

create index idx_generation_log_user_date
  on public.generation_log (user_id, created_at);
