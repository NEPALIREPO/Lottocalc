# Troubleshooting RLS (Row Level Security) Errors

## Error: "new row violates row-level security policy"

This error occurs when you try to insert/update data but your user doesn't have the proper role set in the `public.users` table.

## 🚀 Quick Fix (Run This First!)

### 🎯 COMPLETE UPLOAD FIX (Image Upload → OCR → Save - Recommended!)

**If you're getting RLS errors when uploading images and saving OCR results:**

**Run this SQL in Supabase SQL Editor:**

```sql
-- Run supabase/migrations/022_complete_upload_fix.sql
```

This **one migration** fixes everything:
- ✅ Ensures staff/admin users exist in `public.users`
- ✅ Fixes storage policies for image uploads
- ✅ Fixes INSERT policies for `lottery_reports` and `pos_reports`
- ✅ Fixes UPDATE policies for upsert operations
- ✅ Verifies everything is set up correctly

**After running this, the entire flow should work automatically:**
1. Upload image → ✅ Works
2. OCR extracts data → ✅ Works
3. Save to database → ✅ Works (no more RLS errors!)

### 📷 Report Upload / OCR Fix (Image upload → OCR → Save)

If the RLS error happens **after uploading an image and OCR extracts data** (saving to lottery_reports or pos_reports):

**Run this SQL in Supabase SQL Editor:**

```sql
-- Run supabase/migrations/021_fix_report_upload_rls.sql
```

This migration:
- Adds **UPDATE** policies for `lottery_reports` and `pos_reports` (upsert needs both INSERT and UPDATE)
- Ensures staff and admin are in `public.users` so `get_my_role()` works
- Fixes the "new row violates row-level security policy" when saving OCR results

### ⚡ Staff User Fix (If logged in as staff@k2market.com)

**Run this SQL in Supabase SQL Editor:**

```sql
-- Run supabase/migrations/020_fix_staff_rls_immediate.sql
```

**Or copy-paste this:**

```sql
-- Fix staff user immediately
INSERT INTO public.users (id, name, role)
SELECT id, 'staff', 'STAFF'
FROM auth.users
WHERE email = 'staff@k2market.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'STAFF', name = 'staff', updated_at = NOW();

-- Verify
SELECT 
  u.email,
  p.role,
  CASE 
    WHEN p.role = 'STAFF' THEN '✅ FIXED - Ready to use'
    ELSE '❌ STILL BROKEN'
  END as status
FROM auth.users u
LEFT JOIN public.users p ON u.id = p.id
WHERE u.email = 'staff@k2market.com';
```

### Method 0: Comprehensive Fix (Recommended - Fixes Everything)

**Run this SQL in Supabase SQL Editor:**

```sql
-- Run supabase/migrations/019_comprehensive_rls_fix.sql
```

This script will:
1. ✅ Add admin and staff users to `public.users` if they exist in `auth.users`
2. ✅ Fix all RLS policies
3. ✅ Verify everything is set up correctly
4. ✅ Show a status report

**If users don't exist in `auth.users`, create them first:**
- Go to **Authentication > Users > Add user**
- Create `admin@admin.com` with password `adminadmin`
- Create `staff@k2market.com` with your preferred password
- Then run the script again

### Method 1: Fix by Email (Quick Fix)

**Run this SQL in Supabase SQL Editor:**

```sql
-- Fix admin user
INSERT INTO public.users (id, name, role)
SELECT id, 'admin', 'ADMIN'
FROM auth.users
WHERE email = 'admin@admin.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'ADMIN', name = 'admin';

-- Fix staff user
INSERT INTO public.users (id, name, role)
SELECT id, 'staff', 'STAFF'
FROM auth.users
WHERE email = 'staff@k2market.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'STAFF', name = 'staff';
```

**Or run the migration:**

```sql
-- Run supabase/migrations/018_fix_current_user_rls.sql
```

### Method 2: Diagnostic Script

**Run the diagnostic script in Supabase SQL Editor:**

```sql
-- Run supabase/migrations/017_diagnose_and_fix_rls.sql
```

This script will:
1. ✅ Check if your user exists in `public.users`
2. ✅ Automatically add your user if missing
3. ✅ Show a diagnostic report
4. ✅ List all users and their status

**After running either script, try your operation again.**

## Common Causes

1. **User exists in `auth.users` but NOT in `public.users`**
   - The user was created in Supabase Auth but never added to `public.users`
   - Solution: Add the user to `public.users` with a role

2. **User's role is NULL or incorrect**
   - The user exists in `public.users` but `role` is NULL or not 'ADMIN'/'STAFF'
   - Solution: Update the user's role

3. **RLS policies not properly configured**
   - The migration `016_fix_rls_policies.sql` hasn't been run
   - Solution: Run the migration

## Manual Fix (If Diagnostic Script Doesn't Work)

### Step 1: Check if user exists in public.users

Run this SQL in Supabase SQL Editor (replace with your email):

```sql
SELECT 
  u.id,
  u.email,
  p.name,
  p.role
FROM auth.users u
LEFT JOIN public.users p ON u.id = p.id
WHERE u.email = 'your-email@example.com';
```

### Step 2: If user is missing from public.users

**For Admin:**
```sql
INSERT INTO public.users (id, name, role)
SELECT id, 'Admin User', 'ADMIN'
FROM auth.users
WHERE email = 'admin@admin.com'
ON CONFLICT (id) DO UPDATE SET role = 'ADMIN';
```

**For Staff:**
```sql
INSERT INTO public.users (id, name, role)
SELECT id, 'Staff User', 'STAFF'
FROM auth.users
WHERE email = 'staff@k2market.com'
ON CONFLICT (id) DO UPDATE SET role = 'STAFF';
```

### Step 3: Verify the fix

```sql
SELECT 
  u.email,
  p.role,
  public.get_my_role() as current_role
FROM auth.users u
JOIN public.users p ON u.id = p.id
WHERE u.email = 'your-email@example.com';
```

The `current_role` should match `p.role`.

## Run RLS Fix Migration

If policies are incorrect, run:

```sql
-- Run supabase/migrations/016_fix_rls_policies.sql
```

This ensures all RLS policies are correctly configured.

## Testing RLS

After fixing, test by trying to insert data:

```sql
-- Test as admin (should work)
INSERT INTO public.players (name) VALUES ('Test Player');

-- Test as staff (should work)
INSERT INTO public.daily_box_entries (date, box_id, open_number, created_by)
SELECT 
  CURRENT_DATE,
  (SELECT id FROM public.boxes LIMIT 1),
  100,
  auth.uid();
```

## Still Having Issues?

1. **Check your current role:**
   ```sql
   SELECT public.get_my_role();
   ```
   Should return 'ADMIN' or 'STAFF', not NULL.

2. **Check RLS is enabled:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   AND tablename IN ('players', 'daily_box_entries', 'lottery_reports');
   ```
   All should show `true` for `rowsecurity`.

3. **Check policies exist:**
   ```sql
   SELECT schemaname, tablename, policyname, cmd, qual, with_check
   FROM pg_policies
   WHERE schemaname = 'public'
   AND tablename = 'players';
   ```
   Should show policies with `cmd = 'INSERT'` or `cmd = 'ALL'`.

## Prevention

Always ensure:
1. When creating a new user in `auth.users`, also add them to `public.users`
2. Set the correct role ('ADMIN' or 'STAFF')
3. Run all migrations in order
4. Use the provided user creation scripts (`CREATE_ADMIN_USER.md`, `CREATE_STAFF_USER.md`)
