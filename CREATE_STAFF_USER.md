# Creating Staff User

This guide will help you create the staff user with credentials:
- **Email:** staff@k2market.com
- **Password:** (set your preferred password)

## Method 1: Using Supabase Dashboard (Recommended)

### Step 1: Create Auth User

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Users**
3. Click **Add user** → **Create new user**
4. Fill in the form:
   - **Email:** `staff@k2market.com`
   - **Password:** (choose a secure password)
   - **Auto Confirm User:** ✅ Yes
5. Click **Create user**
6. **Copy the User UID** (you'll see it in the user list)

### Step 2: Set User Role

1. Go to **SQL Editor** in Supabase Dashboard
2. Run the following SQL (it will automatically find the user):

```sql
DO $$
DECLARE
  staff_user_id UUID;
BEGIN
  -- Find the user in auth.users
  SELECT id INTO staff_user_id
  FROM auth.users
  WHERE email = 'staff@k2market.com'
  LIMIT 1;

  -- If user exists, create/update entry in public.users
  IF staff_user_id IS NOT NULL THEN
    INSERT INTO public.users (id, name, role)
    VALUES (staff_user_id, 'Staff User', 'STAFF')
    ON CONFLICT (id) DO UPDATE
    SET role = 'STAFF', name = 'Staff User', updated_at = NOW();
    
    RAISE NOTICE 'Staff user created/updated successfully!';
    RAISE NOTICE 'User ID: %', staff_user_id;
  ELSE
    RAISE EXCEPTION 'User staff@k2market.com not found in auth.users. Please create the user in Supabase Dashboard first.';
  END IF;
END $$;
```

3. You should see a success message with the User ID

### Step 3: Verify

1. Go to your app login page: `http://localhost:3000/login`
2. Login with:
   - Email: `staff@k2market.com`
   - Password: (the password you set)
3. You should be redirected to `/staff/dashboard`

## Method 2: Using Migration Script

If you prefer to use the migration script:

1. **First**, create the user in Supabase Dashboard (Step 1 above)
2. **Then**, run the migration in Supabase SQL Editor:

```sql
-- Run supabase/migrations/014_create_staff_user.sql
```

## Troubleshooting

### "new row violates row-level security policy" (42501) on players or other tables
Your auth user is not in `public.users` with a role, so RLS blocks the action. **You must add your user to `public.users`** (Step 2 above). Run the SQL in Step 2 so your email gets a row in `public.users` with role `STAFF`. Then try again.

### "User not found" error
- Make sure you created the user in **Authentication > Users** first
- Verify the email is exactly `staff@k2market.com` (case-sensitive)

### "Duplicate key" error
- The user already exists in `public.users`
- The script will update the role to STAFF automatically

### Can't login
- Verify the user was created in `auth.users`
- Check that the entry exists in `public.users` with role `STAFF`
- Try resetting the password in Supabase Dashboard

## Verify User Creation

Run this SQL to check if everything is set up correctly:

```sql
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  p.name,
  p.role
FROM auth.users u
LEFT JOIN public.users p ON u.id = p.id
WHERE u.email = 'staff@k2market.com';
```

You should see:
- `email`: staff@k2market.com
- `email_confirmed_at`: a timestamp (not null)
- `name`: Staff User
- `role`: STAFF
