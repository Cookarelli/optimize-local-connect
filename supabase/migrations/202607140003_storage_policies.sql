begin;

-- Private object layout: <organization_uuid>/<uploader_uuid>/<object_name>
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'property-os-private',
  'property-os-private',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/csv',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "property_os_files_read_organization"
on storage.objects for select to authenticated using (
  bucket_id = 'property-os-private'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.is_organization_member(((storage.foldername(name))[1])::uuid)
);

create policy "property_os_files_insert_own_folder"
on storage.objects for insert to authenticated with check (
  bucket_id = 'property-os-private'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_organization_member(((storage.foldername(name))[1])::uuid)
);

create policy "property_os_files_update_own_folder"
on storage.objects for update to authenticated using (
  bucket_id = 'property-os-private'
  and (storage.foldername(name))[2] = auth.uid()::text
) with check (
  bucket_id = 'property-os-private'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_organization_member(((storage.foldername(name))[1])::uuid)
);

create policy "property_os_files_delete_own_folder"
on storage.objects for delete to authenticated using (
  bucket_id = 'property-os-private'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_organization_member(((storage.foldername(name))[1])::uuid)
);

commit;
