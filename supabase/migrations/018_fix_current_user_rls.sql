-- Fix RLS for Current User
-- Run this script while logged in as the user experiencing the RLS error
-- Or replace 'your-email@example.com' with the actual email

-- Option 1: Fix for admin user
DO $$
DECLARE
  admin_email TEXT := 'admin@admin.com';
  admin_user_id UUID;
  admin_role TEXT;
BEGIN
  -- Find admin user by email
  SELECT id INTO admin_user_id FROM auth.users WHERE email = admin_email LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    -- Check if user exists in public.users
    SELECT role INTO admin_role FROM public.users WHERE id = admin_user_id;
    
    IF admin_role IS NULL THEN
      INSERT INTO public.users (id, name, role)
      VALUES (admin_user_id, 'admin', 'ADMIN')
      ON CONFLICT (id) DO UPDATE SET role = 'ADMIN', name = 'admin';
      RAISE NOTICE '✅ Added admin user as ADMIN';
    ELSE
      RAISE NOTICE '✅ Admin user already exists with role: %', admin_role;
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Admin user (admin@admin.com) not found in auth.users. Create the user first.';
  END IF;
END $$;

-- Option 2: Fix for staff user
DO $$
DECLARE
  staff_email TEXT := 'staff@k2market.com';
  staff_user_id UUID;
  staff_role TEXT;
BEGIN
  -- Find staff user by email
  SELECT id INTO staff_user_id FROM auth.users WHERE email = staff_email LIMIT 1;
  
  IF staff_user_id IS NOT NULL THEN
    -- Check if user exists in public.users
    SELECT role INTO staff_role FROM public.users WHERE id = staff_user_id;
    
    IF staff_role IS NULL THEN
      INSERT INTO public.users (id, name, role)
      VALUES (staff_user_id, 'staff', 'STAFF')
      ON CONFLICT (id) DO UPDATE SET role = 'STAFF', name = 'staff';
      RAISE NOTICE '✅ Added staff user as STAFF';
    ELSE
      RAISE NOTICE '✅ Staff user already exists with role: %', staff_role;
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Staff user (staff@k2market.com) not found in auth.users. Create the user first.';
  END IF;
END $$;

-- Option 2: Fix for currently authenticated user (if running from app context)
-- This will only work if you're authenticated
DO $$
DECLARE
  current_user_id UUID := auth.uid();
  user_email TEXT;
  user_role TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'No authenticated user. Use Option 1 above with your email.';
    RETURN;
  END IF;
  
  SELECT email INTO user_email FROM auth.users WHERE id = current_user_id;
  SELECT role INTO user_role FROM public.users WHERE id = current_user_id;
  
  IF user_role IS NULL THEN
    IF user_email LIKE '%admin%' THEN
      INSERT INTO public.users (id, name, role)
      VALUES (current_user_id, 'Admin User', 'ADMIN')
      ON CONFLICT (id) DO UPDATE SET role = 'ADMIN', name = 'Admin User';
      RAISE NOTICE '✅ Added current user as ADMIN';
    ELSE
      INSERT INTO public.users (id, name, role)
      VALUES (current_user_id, 'Staff User', 'STAFF')
      ON CONFLICT (id) DO UPDATE SET role = 'STAFF', name = 'Staff User';
      RAISE NOTICE '✅ Added current user as STAFF';
    END IF;
  ELSE
    RAISE NOTICE '✅ Current user already has role: %', user_role;
  END IF;
END $$;

-- Verify fix for both users
SELECT 
  u.email,
  p.name,
  p.role,
  CASE 
    WHEN p.role IN ('ADMIN', 'STAFF') THEN '✅ FIXED - Ready to use'
    WHEN p.role IS NULL THEN '❌ STILL BROKEN - Role is NULL'
    WHEN p.id IS NULL THEN '❌ STILL BROKEN - User not in public.users'
    ELSE '⚠️ WARNING - Invalid role'
  END as status
FROM auth.users u
LEFT JOIN public.users p ON u.id = p.id
WHERE u.email IN ('admin@admin.com', 'staff@k2market.com')
ORDER BY u.email;
