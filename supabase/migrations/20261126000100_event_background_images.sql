alter table public.campus_events
  add column if not exists cover_path text;

comment on column public.campus_events.cover_path is
  'Storage path for the event poster/background in the campus-media bucket.';
