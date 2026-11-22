-- 016_camera.sql : Foto kamera. Aman dijalankan berulang.
ALTER TABLE public.camera_snapshots DROP CONSTRAINT IF EXISTS snapshot_device_fk;
ALTER TABLE public.camera_snapshots ADD CONSTRAINT snapshot_device_fk
  FOREIGN KEY (organization_id, device_id) REFERENCES public.devices (organization_id, id) ON DELETE CASCADE;
ALTER TABLE public.camera_snapshots DROP CONSTRAINT IF EXISTS snapshot_size_range;
ALTER TABLE public.camera_snapshots ADD CONSTRAINT snapshot_size_range CHECK (size_bytes BETWEEN 100 AND 1572864);
ALTER TABLE public.camera_snapshots DROP CONSTRAINT IF EXISTS snapshot_type_valid;
ALTER TABLE public.camera_snapshots ADD CONSTRAINT snapshot_type_valid CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp'));
