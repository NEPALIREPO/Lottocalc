-- Create storage bucket for receipts
-- Note: This migration creates the bucket via SQL, but you may need to create it manually in Supabase Dashboard
-- if SQL bucket creation is not available in your Supabase plan.

-- For Supabase projects, buckets are typically created via the Dashboard or Storage API.
-- This file serves as documentation. To create the bucket:

-- Option 1: Via Supabase Dashboard (Recommended)
-- 1. Go to Storage in Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Name: receipts
-- 4. Public: Yes (check the box)
-- 5. Click "Create bucket"

-- Option 2: Via SQL (if supported)
-- Note: This may not work on all Supabase plans. Use Dashboard method if SQL fails.

-- Insert bucket into storage.buckets table
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy to allow authenticated users to upload
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Create storage policy to allow public read access
CREATE POLICY "Public can read receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- Create storage policy to allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts');

-- Create storage policy to allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');
