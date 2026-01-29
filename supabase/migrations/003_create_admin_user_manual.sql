-- MANUAL ADMIN USER CREATION
-- 
-- Run this AFTER you've created the user in Supabase Dashboard
-- This version will NOT fail if the user doesn't exist yet
--
-- To create the auth user:
-- 1. Supabase Dashboard > Authentication > Users > Add user
-- 2. Email: admin@admin.com
-- 3. Password: adminadmin  
-- 4. Auto Confirm: Yes
-- 5. Create user
--
-- Then run this script:

INSERT INTO public.users (id, name, role)
SELECT 
  id,
  'Admin User',
  'ADMIN'
FROM auth.users
WHERE email = 'admin@admin.com'
ON CONFLICT (id) DO UPDATE
SET 
  role = 'ADMIN',
  name = 'Admin User',
  updated_at = NOW();

-- Verify the user was created
SELECT 
  u.id,
  u.email,
  p.name,
  p.role,
  CASE 
    WHEN p.id IS NOT NULL THEN '✅ User role set successfully'
    ELSE '❌ User not found in public.users'
  END as status
FROM auth.users u
LEFT JOIN public.users p ON u.id = p.id
WHERE u.email = 'admin@admin.com';
