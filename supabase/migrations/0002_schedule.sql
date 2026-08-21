alter table public.posts
  add column if not exists scheduled_at timestamptz,
  add column if not exists priority int not null default 10,
  add column if not exists published_at timestamptz,
  add column if not exists reactions int not null default 0,
  add column if not exists subscribers int not null default 0;

alter table public.channels
  add column if not exists quiet_hours int[] not null default '{}',
  add column if not exists max_posts_per_day int not null default 5,
  add column if not exists post_hour int,
  add column if not exists features jsonb not null default '{}',
  add column if not exists vacation_from date,
  add column if not exists vacation_to date;

create index if not exists idx_posts_due
  on public.posts (channel_id, status, scheduled_at);
