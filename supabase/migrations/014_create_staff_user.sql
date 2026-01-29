-- Create staff user
--
-- If staff@k2market.com exists in auth.users, this sets their role to STAFF.
-- If the user doesn't exist yet, this does nothing (no error).
-- Create the user in Dashboard first: Authentication > Users > Add user
--   Email: staff@k2market.com  Password: (set your password)  Auto Confirm: Yes

INSERT INTO public.users (id, name, role)
SELECT id, 'Staff User', 'STAFF'
FROM auth.users
WHERE email = 'staff@k2market.com'
ON CONFLICT (id) DO UPDATE
SET role = 'STAFF', name = 'Staff User', updated_at = NOW();
