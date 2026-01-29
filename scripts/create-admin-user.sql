-- Manual SQL script to create admin user
-- 
-- STEP 1: Create the user in Supabase Auth UI:
--   1. Go to Supabase Dashboard > Authentication > Users
--   2. Click "Add user" > "Create new user"
--   3. Email: admin@admin.com
--   4. Password: adminadmin
--   5. Auto Confirm User: Yes
--   6. Click "Create user"
--   7. Copy the User UID that appears
--
-- STEP 2: Replace 'USER_UID_HERE' below with the actual User UID from step 1
-- STEP 3: Run this SQL script in Supabase SQL Editor

-- Option 1: If you know the User UID (recommended)
-- Replace 'USER_UID_HERE' with the actual UUID from auth.users
/*
INSERT INTO public.users (id, name, role)
SELECT id, 'Admin User', 'ADMIN'
FROM auth.users
WHERE email = 'admin@admin.com'
ON CONFLICT (id) DO UPDATE
SET role = 'ADMIN', name = 'Admin User', updated_at = NOW();
*/

-- Option 2: Safe version - sets role if user exists, does nothing otherwise (no error)
INSERT INTO public.users (id, name, role)
SELECT id, 'Admin User', 'ADMIN'
FROM auth.users
WHERE email = 'admin@admin.com'
ON CONFLICT (id) DO UPDATE
SET role = 'ADMIN', name = 'Admin User', updated_at = NOW();
