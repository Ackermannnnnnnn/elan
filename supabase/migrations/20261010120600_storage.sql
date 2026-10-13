-- =============================================================================
-- 0007 · Stockage des images
-- Deux buckets PRIVÉS. Chaque fichier est rangé sous `<user_id>/…` et les
-- politiques n'autorisent l'accès qu'au dossier de l'utilisateur connecté.
-- L'affichage passe par des URL signées à durée courte.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('meal-photos', 'meal-photos', false, 8388608,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']),
  ('progress-photos', 'progress-photos', false, 8388608,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy user_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id in ('meal-photos', 'progress-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy user_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('meal-photos', 'progress-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy user_photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id in ('meal-photos', 'progress-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('meal-photos', 'progress-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy user_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('meal-photos', 'progress-photos')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
