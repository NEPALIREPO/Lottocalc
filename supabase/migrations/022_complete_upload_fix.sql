-- Complete Fix for Image Upload → OCR → Save Flow
-- This ensures the entire flow works automatically without RLS errors

-- ========== STEP 1: Ensure get_my_role() function exists and works ==========
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Grant execute to all roles
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO service_role;

-- ========== STEP 2: Ensure users exist in public.users ==========
-- This is CRITICAL - without this, get_my_role() returns NULL and RLS fails

-- Fix admin user
INSERT INTO public.users (id, name, role)
SELECT id, 'admin', 'ADMIN'
FROM auth.users
WHERE email = 'admin@admin.com'
ON CONFLICT (id) DO UPDATE
SET role = 'ADMIN', name = 'admin', updated_at = NOW();

-- Fix staff user
INSERT INTO public.users (id, name, role)
SELECT id, 'staff', 'STAFF'
FROM auth.users
WHERE email = 'staff@k2market.com'
ON CONFLICT (id) DO UPDATE
SET role = 'STAFF', name = 'staff', updated_at = NOW();

-- ========== STEP 3: Fix Storage Policies (for image upload) ==========
-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Public can read receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete receipts" ON storage.objects;

-- Create storage policies that work for authenticated users
-- Note: Storage policies don't need get_my_role() - they just check authenticated
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Public can read receipts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'receipts');

CREATE POLICY "Authenticated users can update receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Authenticated users can delete receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

-- ========== STEP 4: Fix Lottery Reports Policies ==========
DROP POLICY IF EXISTS "Staff can insert lottery reports" ON public.lottery_reports;
DROP POLICY IF EXISTS "Staff can update lottery reports" ON public.lottery_reports;
DROP POLICY IF EXISTS "Authenticated users can read lottery reports" ON public.lottery_reports;

-- INSERT policy (for new reports)
CREATE POLICY "Staff can insert lottery reports" ON public.lottery_reports
  FOR INSERT
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- UPDATE policy (for upsert when report already exists)
CREATE POLICY "Staff can update lottery reports" ON public.lottery_reports
  FOR UPDATE
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- SELECT policy (for reading reports)
CREATE POLICY "Authenticated users can read lottery reports" ON public.lottery_reports
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ========== STEP 5: Fix POS Reports Policies ==========
DROP POLICY IF EXISTS "Staff can insert POS reports" ON public.pos_reports;
DROP POLICY IF EXISTS "Staff can update POS reports" ON public.pos_reports;
DROP POLICY IF EXISTS "Authenticated users can read POS reports" ON public.pos_reports;

-- INSERT policy (for new reports)
CREATE POLICY "Staff can insert POS reports" ON public.pos_reports
  FOR INSERT
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- UPDATE policy (for upsert when report already exists)
CREATE POLICY "Staff can update POS reports" ON public.pos_reports
  FOR UPDATE
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- SELECT policy (for reading reports)
CREATE POLICY "Authenticated users can read POS reports" ON public.pos_reports
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ========== STEP 6: Verify Everything ==========
DO $$
DECLARE
  admin_count INTEGER;
  staff_count INTEGER;
BEGIN
  -- Check admin user
  SELECT COUNT(*) INTO admin_count
  FROM auth.users u
  JOIN public.users p ON u.id = p.id
  WHERE u.email = 'admin@admin.com' AND p.role = 'ADMIN';
  
  -- Check staff user
  SELECT COUNT(*) INTO staff_count
  FROM auth.users u
  JOIN public.users p ON u.id = p.id
  WHERE u.email = 'staff@k2market.com' AND p.role = 'STAFF';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Upload Fix Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Admin user status: %', CASE WHEN admin_count > 0 THEN '✅ OK' ELSE '⚠️ Not found in auth.users' END;
  RAISE NOTICE 'Staff user status: %', CASE WHEN staff_count > 0 THEN '✅ OK' ELSE '⚠️ Not found in auth.users' END;
  RAISE NOTICE '';
  RAISE NOTICE 'The image upload → OCR → save flow should now work!';
  RAISE NOTICE 'If users show ⚠️, create them in Supabase Dashboard first.';
  RAISE NOTICE '========================================';
END $$;

-- Final verification query
SELECT 
  'User Status' as check_type,
  u.email,
  p.role,
  CASE 
    WHEN p.role IN ('ADMIN', 'STAFF') THEN '✅ Ready for uploads'
    WHEN p.id IS NULL THEN '❌ Not in public.users - Run this migration again'
    WHEN u.id IS NULL THEN '❌ Not in auth.users - Create user in Dashboard'
    ELSE '⚠️ Check role'
  END as status
FROM (VALUES ('admin@admin.com'), ('staff@k2market.com')) AS expected_emails(email)
LEFT JOIN auth.users u ON u.email = expected_emails.email
LEFT JOIN public.users p ON p.id = u.id
ORDER BY expected_emails.email;
