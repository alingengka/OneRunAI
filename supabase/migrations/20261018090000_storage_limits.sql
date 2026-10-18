-- Upload limits per bucket, so nobody can fill storage with huge or
-- non-media files through their own folder.
update storage.buckets
  set file_size_limit = 5242880, -- 5 MB
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
  where id = 'payment-slips';

update storage.buckets
  set file_size_limit = 104857600, -- 100 MB
      allowed_mime_types = array['image/*', 'video/*']
  where id = 'broll-assets';

update storage.buckets
  set file_size_limit = 5242880, -- 5 MB
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
  where id = 'site-assets';
