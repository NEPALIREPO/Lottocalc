-- Create admin user
--
-- If admin@admin.com exists in auth.users, this sets their role to ADMIN.
-- If the user doesn't exist yet, this does nothing (no error).
-- Create the user in Dashboard first: Authentication > Users > Add user
--   Email: admin@admin.com  Password: adminadmin  Auto Confirm: Yes

INSERT INTO public.users (id, name, role)
SELECT id, 'Admin User', 'ADMIN'
FROM auth.users
WHERE email = 'admin@admin.com'
ON CONFLICT (id) DO UPDATE
SET role = 'ADMIN', name = 'Admin User', updated_at = NOW();
