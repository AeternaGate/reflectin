create table public.channel_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'moderator',
  created_at timestamptz not null default now()
);

create index if not exists idx_channel_members_channel
  on public.channel_members (channel_id, user_id);

create table public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.monitoring_channels (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  source text not null,
  created_at timestamptz not null default now()
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table public.agent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  agent text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.stars_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount int not null,
  plan text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
