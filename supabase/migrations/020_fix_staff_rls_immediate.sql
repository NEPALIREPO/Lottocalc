-- Immediate Fix for Staff User RLS Issues
-- Run this while logged in as staff@k2market.com OR run it to fix the staff user

-- Step 1: Ensure staff user exists in public.users
DO $$
DECLARE
  staff_id UUID;
  staff_role TEXT;
BEGIN
  -- Find staff user
  SELECT id INTO staff_id FROM auth.users WHERE email = 'staff@k2market.com' LIMIT 1;
  
  IF staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff user (staff@k2market.com) not found in auth.users. Please create the user in Supabase Dashboard first: Authentication > Users > Add user';
  END IF;
  
  -- Check current status
  SELECT role INTO staff_role FROM public.users WHERE id = staff_id;
  
  -- Insert or update
  INSERT INTO public.users (id, name, role)
  VALUES (staff_id, 'staff', 'STAFF')
  ON CONFLICT (id) DO UPDATE 
  SET role = 'STAFF', 
      name = 'staff', 
      updated_at = NOW();
  
  RAISE NOTICE '✅ Staff user fixed!';
  RAISE NOTICE '   User ID: %', staff_id;
  RAISE NOTICE '   Role: STAFF';
END $$;

-- Step 2: Verify get_my_role() works for staff
SELECT 
  'Staff User Verification' as check_type,
  u.email,
  p.name,
  p.role,
  public.get_my_role() as get_my_role_result,
  CASE 
    WHEN p.role = 'STAFF' AND public.get_my_role() = 'STAFF' THEN '✅ PERFECT - Ready to use'
    WHEN p.role = 'STAFF' AND public.get_my_role() IS NULL THEN '⚠️ Role exists but get_my_role() returns NULL - Check function permissions'
    WHEN p.role IS NULL THEN '❌ Role is NULL'
    WHEN p.id IS NULL THEN '❌ User not in public.users'
    ELSE '⚠️ Unexpected state'
  END as status
FROM auth.users u
LEFT JOIN public.users p ON u.id = p.id
WHERE u.email = 'staff@k2market.com';

-- Step 3: Ensure get_my_role() function has proper permissions
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;

-- Step 4: Double-check all INSERT policies allow STAFF role
-- Daily box entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'daily_box_entries'
    AND policyname = 'Staff can insert daily box entries'
    AND (qual::text LIKE '%STAFF%' OR with_check::text LIKE '%STAFF%')
  ) THEN
    RAISE NOTICE '⚠️ Daily box entries policy may need update';
  ELSE
    RAISE NOTICE '✅ Daily box entries policy OK';
  END IF;
END $$;

-- Players
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'players'
    AND policyname = 'Staff can manage players'
    AND (qual::text LIKE '%STAFF%' OR with_check::text LIKE '%STAFF%')
  ) THEN
    RAISE NOTICE '⚠️ Players policy may need update';
  ELSE
    RAISE NOTICE '✅ Players policy OK';
  END IF;
END $$;

-- Player transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'player_transactions'
    AND policyname = 'Staff can insert player transactions'
    AND (qual::text LIKE '%STAFF%' OR with_check::text LIKE '%STAFF%')
  ) THEN
    RAISE NOTICE '⚠️ Player transactions policy may need update';
  ELSE
    RAISE NOTICE '✅ Player transactions policy OK';
  END IF;
END $$;

-- Lottery reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'lottery_reports'
    AND policyname = 'Staff can insert lottery reports'
    AND (qual::text LIKE '%STAFF%' OR with_check::text LIKE '%STAFF%')
  ) THEN
    RAISE NOTICE '⚠️ Lottery reports policy may need update';
  ELSE
    RAISE NOTICE '✅ Lottery reports policy OK';
  END IF;
END $$;

-- POS reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'pos_reports'
    AND policyname = 'Staff can insert POS reports'
    AND (qual::text LIKE '%STAFF%' OR with_check::text LIKE '%STAFF%')
  ) THEN
    RAISE NOTICE '⚠️ POS reports policy may need update';
  ELSE
    RAISE NOTICE '✅ POS reports policy OK';
  END IF;
END $$;

-- Activated books
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'activated_books'
    AND policyname = 'Staff can insert activated books'
    AND (qual::text LIKE '%STAFF%' OR with_check::text LIKE '%STAFF%')
  ) THEN
    RAISE NOTICE '⚠️ Activated books policy may need update';
  ELSE
    RAISE NOTICE '✅ Activated books policy OK';
  END IF;
END $$;

-- Step 5: Recreate all policies to ensure they're correct
DROP POLICY IF EXISTS "Staff can insert daily box entries" ON public.daily_box_entries;
CREATE POLICY "Staff can insert daily box entries" ON public.daily_box_entries
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

DROP POLICY IF EXISTS "Staff can update own entries" ON public.daily_box_entries;
CREATE POLICY "Staff can update own entries" ON public.daily_box_entries
  FOR UPDATE 
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

DROP POLICY IF EXISTS "Staff can insert lottery reports" ON public.lottery_reports;
CREATE POLICY "Staff can insert lottery reports" ON public.lottery_reports
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

DROP POLICY IF EXISTS "Staff can insert POS reports" ON public.pos_reports;
CREATE POLICY "Staff can insert POS reports" ON public.pos_reports
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

DROP POLICY IF EXISTS "Staff can manage players" ON public.players;
CREATE POLICY "Staff can manage players" ON public.players
  FOR ALL
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

DROP POLICY IF EXISTS "Staff can insert player transactions" ON public.player_transactions;
CREATE POLICY "Staff can insert player transactions" ON public.player_transactions
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

DROP POLICY IF EXISTS "Staff can insert activated books" ON public.activated_books;
CREATE POLICY "Staff can insert activated books" ON public.activated_books
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Final verification
SELECT 
  'Final Status' as check_type,
  u.email,
  p.role,
  CASE 
    WHEN p.role = 'STAFF' THEN '✅ Staff user is ready!'
    ELSE '❌ Staff user not properly configured'
  END as status
FROM auth.users u
LEFT JOIN public.users p ON u.id = p.id
WHERE u.email = 'staff@k2market.com';

RAISE NOTICE '';
RAISE NOTICE '========================================';
RAISE NOTICE 'Staff RLS Fix Complete!';
RAISE NOTICE '========================================';
RAISE NOTICE 'If you still get RLS errors:';
RAISE NOTICE '1. Make sure you are logged in as staff@k2market.com';
RAISE NOTICE '2. Check which table is causing the error';
RAISE NOTICE '3. Verify the user shows ✅ PERFECT above';
RAISE NOTICE '========================================';
