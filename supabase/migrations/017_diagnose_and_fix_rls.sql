-- Diagnostic and Fix Script for RLS Issues
-- Run this to check and fix RLS problems

-- Step 1: Check current user's role status
DO $$
DECLARE
  current_user_id UUID;
  user_role TEXT;
  user_email TEXT;
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'No authenticated user found. Please log in first.';
    RETURN;
  END IF;
  
  -- Get user email
  SELECT email INTO user_email FROM auth.users WHERE id = current_user_id;
  
  -- Check if user exists in public.users
  SELECT role INTO user_role FROM public.users WHERE id = current_user_id;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS Diagnostic Report';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'User ID: %', current_user_id;
  RAISE NOTICE 'Email: %', user_email;
  RAISE NOTICE 'Role in public.users: %', COALESCE(user_role, 'NULL - USER NOT FOUND');
  RAISE NOTICE 'get_my_role() returns: %', public.get_my_role();
  RAISE NOTICE '========================================';
  
  -- If user doesn't exist in public.users, add them
  IF user_role IS NULL THEN
    RAISE NOTICE 'User not found in public.users. Attempting to add...';
    
    -- Determine role from email
    IF user_email = 'admin@admin.com' THEN
      INSERT INTO public.users (id, name, role)
      VALUES (current_user_id, 'admin', 'ADMIN')
      ON CONFLICT (id) DO UPDATE SET role = 'ADMIN', name = 'admin';
      RAISE NOTICE 'Added user as ADMIN';
    ELSIF user_email = 'staff@k2market.com' THEN
      INSERT INTO public.users (id, name, role)
      VALUES (current_user_id, 'staff', 'STAFF')
      ON CONFLICT (id) DO UPDATE SET role = 'STAFF', name = 'staff';
      RAISE NOTICE 'Added user as STAFF';
    ELSIF user_email LIKE '%admin%' THEN
      INSERT INTO public.users (id, name, role)
      VALUES (current_user_id, 'admin', 'ADMIN')
      ON CONFLICT (id) DO UPDATE SET role = 'ADMIN', name = 'admin';
      RAISE NOTICE 'Added user as ADMIN (detected from email)';
    ELSE
      INSERT INTO public.users (id, name, role)
      VALUES (current_user_id, 'staff', 'STAFF')
      ON CONFLICT (id) DO UPDATE SET role = 'STAFF', name = 'staff';
      RAISE NOTICE 'Added user as STAFF (default)';
    END IF;
    
    RAISE NOTICE 'User added successfully!';
  ELSE
    RAISE NOTICE 'User already exists with role: %', user_role;
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- Step 2: Verify get_my_role() function works
SELECT 
  'get_my_role() test' as test_name,
  public.get_my_role() as result,
  CASE 
    WHEN public.get_my_role() IN ('ADMIN', 'STAFF') THEN 'PASS'
    WHEN public.get_my_role() IS NULL THEN 'FAIL - User not in public.users'
    ELSE 'FAIL - Invalid role'
  END as status;

-- Step 3: List all users and their roles (focus on admin and staff)
SELECT 
  u.email,
  u.id as auth_id,
  p.id as public_id,
  p.name,
  p.role,
  CASE 
    WHEN p.id IS NULL THEN '❌ MISSING FROM public.users'
    WHEN p.role IS NULL THEN '❌ ROLE IS NULL'
    WHEN p.role NOT IN ('ADMIN', 'STAFF') THEN '⚠️ INVALID ROLE'
    ELSE '✅ OK'
  END as status
FROM auth.users u
LEFT JOIN public.users p ON u.id = p.id
WHERE u.email IN ('admin@admin.com', 'staff@k2market.com')
   OR p.id IS NOT NULL
ORDER BY 
  CASE WHEN u.email IN ('admin@admin.com', 'staff@k2market.com') THEN 0 ELSE 1 END,
  u.email;
