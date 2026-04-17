alter table metrics_snapshots add column project text not null default '';

create index on metrics_snapshots (project, fetched_at desc);
