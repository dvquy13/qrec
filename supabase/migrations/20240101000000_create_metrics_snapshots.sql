create table metrics_snapshots (
  id         bigint generated always as identity primary key,
  fetched_at timestamptz not null,
  metrics    jsonb not null
);

create index on metrics_snapshots (fetched_at desc);

-- Allow public read access (anon key used by dashboard HTML)
alter table metrics_snapshots enable row level security;
create policy "public read" on metrics_snapshots for select using (true);
