-- Private, authenticated voice notes. Conversation access is checked on both
-- the message row and the storage object; audio is never made public.
alter table public.messages add column if not exists audio_path text;
alter table public.profiles add column if not exists bio varchar(240) not null default '';
alter table public.messages drop constraint if exists messages_voice_path_check;
alter table public.messages add constraint messages_voice_path_check
  check (audio_path is null or (audio_path like sender_id::text || '/voice-%' and length(audio_path) <= 300));

update storage.buckets
set allowed_mime_types = array['video/mp4','video/webm','audio/webm','audio/ogg','audio/mp4','image/jpeg','image/png','application/pdf']
where id = 'campus-media';

drop policy if exists "Conversation members view voice notes" on storage.objects;
create policy "Conversation members view voice notes" on storage.objects for select to authenticated
using (
  bucket_id = 'campus-media'
  and exists (
    select 1 from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.audio_path = name and (c.low_user_id = auth.uid() or c.high_user_id = auth.uid())
  )
);

drop policy if exists "Members upload voice notes to own folder" on storage.objects;
create policy "Members upload voice notes to own folder" on storage.objects for insert to authenticated
with check (
  bucket_id = 'campus-media'
  and name like auth.uid()::text || '/voice-%'
  and (storage.foldername(name))[1] = auth.uid()::text
);
