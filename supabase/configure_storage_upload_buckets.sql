-- One-time Storage bucket configuration for V2.24-dev.
-- Run this in the Supabase SQL Editor when preparing a new Supabase project.
-- The legacy "uploads" bucket is intentionally left unchanged.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'content',
    'content',
    true,
    12582912,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  ),
  (
    'avatars',
    'avatars',
    true,
    4194304,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  ),
  (
    'photos',
    'photos',
    true,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Verify the effective bucket settings after applying the script.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('content', 'avatars', 'photos')
order by id;
