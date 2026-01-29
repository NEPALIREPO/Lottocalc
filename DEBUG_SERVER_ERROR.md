# Debugging Server Components Render Error (Code: 2704750074)

## What This Error Means

This error occurs when a Server Component fails during rendering. Next.js hides the actual error message in production to avoid leaking sensitive information.

## Common Causes (Even With Env Vars Set)

### 1. **Row Level Security (RLS) Policy Issues**
   - **Symptom**: Queries fail silently due to RLS policies blocking access
   - **Check**: 
     - Go to Supabase Dashboard → Authentication → Policies
     - Verify your user has the correct role in `public.users` table
     - Check RLS policies allow SELECT operations for authenticated users
   - **Fix**: Review and update RLS policies in Supabase

### 2. **Missing User in `public.users` Table**
   - **Symptom**: User exists in `auth.users` but not in `public.users`
   - **Check**: 
     ```sql
     SELECT * FROM public.users WHERE id = 'your-user-id';
     ```
   - **Fix**: Ensure user is created in `public.users` with correct role

### 3. **Database Query Failures**
   - **Symptom**: One of the queries in the server component fails
   - **Check**: 
     - Check Vercel function logs for specific error messages
     - Look for console.error messages we added
   - **Common Issues**:
     - `.single()` called when no record exists
     - Missing columns in SELECT queries
     - Foreign key constraint violations

### 4. **Missing Database Tables/Columns**
   - **Symptom**: Queries reference tables or columns that don't exist
   - **Check**: 
     - Verify all migrations have been run in Supabase
     - Check table structure matches what code expects
   - **Fix**: Run missing migrations in Supabase SQL Editor

### 5. **Authentication Token Issues**
   - **Symptom**: Supabase client can't authenticate
   - **Check**:
     - Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
     - Check if token has expired
   - **Fix**: Regenerate anon key if needed

## How to Debug

### Step 1: Check Vercel Function Logs
1. Go to Vercel Dashboard → Your Project → Functions
2. Look for error logs with timestamps matching when the error occurred
3. Check for specific error messages we added (they start with "Error fetching...")

### Step 2: Check Browser Console
1. Open browser DevTools (F12)
2. Check Console tab for error messages
3. Look for "Error fetching..." messages that identify which query failed

### Step 3: Test Individual Queries
Run these in Supabase SQL Editor to verify data access:

```sql
-- Check user exists and has role
SELECT id, role FROM public.users WHERE id = 'your-user-id';

-- Check boxes table
SELECT * FROM boxes LIMIT 5;

-- Check daily box entries
SELECT * FROM daily_box_entries WHERE date = CURRENT_DATE LIMIT 5;

-- Check lottery reports
SELECT * FROM lottery_reports WHERE date = CURRENT_DATE LIMIT 5;

-- Check player transactions
SELECT * FROM player_transactions WHERE date = CURRENT_DATE LIMIT 5;
```

### Step 4: Verify RLS Policies
Check if your user can access the data:

```sql
-- Test as your user (replace with your user ID)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'your-user-id';

-- Try to select from each table
SELECT * FROM boxes LIMIT 1;
SELECT * FROM daily_box_entries LIMIT 1;
SELECT * FROM lottery_reports LIMIT 1;
SELECT * FROM players LIMIT 1;
```

## Recent Fixes Applied

1. ✅ Added error handling to all database queries
2. ✅ Fixed `.single()` calls that could fail when no data exists
3. ✅ Added console.error logging to identify failing queries
4. ✅ Added fallback values to prevent complete failures

## Next Steps

1. **Check Vercel Logs**: Look for the specific error message that identifies which query is failing
2. **Verify User Role**: Ensure your user has the correct role in `public.users`
3. **Check RLS Policies**: Verify policies allow your user to read the required tables
4. **Test Queries**: Run the SQL queries above to verify data access

## If Error Persists

1. Share the specific error message from Vercel logs (not just the code)
2. Share which page/route is failing (admin dashboard, staff dashboard, etc.)
3. Verify your Supabase project has all migrations applied
4. Check if the error occurs for all users or just specific ones
