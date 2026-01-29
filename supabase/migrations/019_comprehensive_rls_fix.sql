-- Comprehensive RLS Fix Script
-- This script will fix ALL RLS issues for admin and staff users

-- Step 1: Ensure users exist in auth.users and add them to public.users
DO $$
DECLARE
  admin_id UUID;
  staff_id UUID;
BEGIN
  -- Fix admin user
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@admin.com' LIMIT 1;
  
  IF admin_id IS NOT NULL THEN
    INSERT INTO public.users (id, name, role)
    VALUES (admin_id, 'admin', 'ADMIN')
    ON CONFLICT (id) DO UPDATE 
    SET role = 'ADMIN', name = 'admin', updated_at = NOW();
    RAISE NOTICE '✅ Admin user fixed: %', admin_id;
  ELSE
    RAISE NOTICE '⚠️ Admin user (admin@admin.com) not found in auth.users';
    RAISE NOTICE '   Please create the user in Supabase Dashboard first:';
    RAISE NOTICE '   Authentication > Users > Add user > admin@admin.com';
  END IF;
  
  -- Fix staff user
  SELECT id INTO staff_id FROM auth.users WHERE email = 'staff@k2market.com' LIMIT 1;
  
  IF staff_id IS NOT NULL THEN
    INSERT INTO public.users (id, name, role)
    VALUES (staff_id, 'staff', 'STAFF')
    ON CONFLICT (id) DO UPDATE 
    SET role = 'STAFF', name = 'staff', updated_at = NOW();
    RAISE NOTICE '✅ Staff user fixed: %', staff_id;
  ELSE
    RAISE NOTICE '⚠️ Staff user (staff@k2market.com) not found in auth.users';
    RAISE NOTICE '   Please create the user in Supabase Dashboard first:';
    RAISE NOTICE '   Authentication > Users > Add user > staff@k2market.com';
  END IF;
END $$;

-- Step 2: Ensure get_my_role() function exists and has proper permissions
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;

-- Step 3: Ensure all RLS policies are correct
-- Daily box entries
DROP POLICY IF EXISTS "Staff can insert daily box entries" ON public.daily_box_entries;
CREATE POLICY "Staff can insert daily box entries" ON public.daily_box_entries
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

DROP POLICY IF EXISTS "Staff can update own entries" ON public.daily_box_entries;
CREATE POLICY "Staff can update own entries" ON public.daily_box_entries
  FOR UPDATE 
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Lottery reports
DROP POLICY IF EXISTS "Staff can insert lottery reports" ON public.lottery_reports;
CREATE POLICY "Staff can insert lottery reports" ON public.lottery_reports
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- POS reports
DROP POLICY IF EXISTS "Staff can insert POS reports" ON public.pos_reports;
CREATE POLICY "Staff can insert POS reports" ON public.pos_reports
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Players
DROP POLICY IF EXISTS "Staff can manage players" ON public.players;
CREATE POLICY "Staff can manage players" ON public.players
  FOR ALL
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Player transactions
DROP POLICY IF EXISTS "Staff can insert player transactions" ON public.player_transactions;
CREATE POLICY "Staff can insert player transactions" ON public.player_transactions
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Activated books
DROP POLICY IF EXISTS "Staff can insert activated books" ON public.activated_books;
CREATE POLICY "Staff can insert activated books" ON public.activated_books
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Boxes (Admin only)
DROP POLICY IF EXISTS "Admin can manage boxes" ON public.boxes;
CREATE POLICY "Admin can manage boxes" ON public.boxes
  FOR ALL
  USING (public.get_my_role() = 'ADMIN')
  WITH CHECK (public.get_my_role() = 'ADMIN');

-- Step 4: Verify everything is set up correctly
SELECT 
  'Verification Report' as report_type,
  u.email,
  CASE 
    WHEN u.id IS NULL THEN '❌ NOT IN auth.users'
    WHEN p.id IS NULL THEN '❌ NOT IN public.users'
    WHEN p.role IS NULL THEN '❌ ROLE IS NULL'
    WHEN p.role NOT IN ('ADMIN', 'STAFF') THEN '⚠️ INVALID ROLE: ' || p.role
    ELSE '✅ OK - Role: ' || p.role
  END as status,
  p.name,
  p.role
FROM (VALUES 
  ('admin@admin.com'),
  ('staff@k2market.com')
) AS expected_emails(email)
LEFT JOIN auth.users u ON u.email = expected_emails.email
LEFT JOIN public.users p ON p.id = u.id
ORDER BY expected_emails.email;

-- Step 5: Test get_my_role() for each user (if they exist)
DO $$
DECLARE
  test_user_id UUID;
  test_role TEXT;
BEGIN
  -- Test admin
  SELECT id INTO test_user_id FROM auth.users WHERE email = 'admin@admin.com' LIMIT 1;
  IF test_user_id IS NOT NULL THEN
    -- Temporarily set auth context (this won't work in SQL editor, but shows what should happen)
    RAISE NOTICE 'Admin user ID: %', test_user_id;
    SELECT role INTO test_role FROM public.users WHERE id = test_user_id;
    RAISE NOTICE 'Admin role in public.users: %', COALESCE(test_role, 'NULL');
  END IF;
  
  -- Test staff
  SELECT id INTO test_user_id FROM auth.users WHERE email = 'staff@k2market.com' LIMIT 1;
  IF test_user_id IS NOT NULL THEN
    RAISE NOTICE 'Staff user ID: %', test_user_id;
    SELECT role INTO test_role FROM public.users WHERE id = test_user_id;
    RAISE NOTICE 'Staff role in public.users: %', COALESCE(test_role, 'NULL');
  END IF;
END $$;

-- Final message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS Fix Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Verify users are listed as ✅ OK above';
  RAISE NOTICE '2. If users show ❌, create them in Supabase Dashboard first';
  RAISE NOTICE '3. Try your operation again';
  RAISE NOTICE '4. If still failing, check which table is causing the error';
  RAISE NOTICE '========================================';
END $$;
