-- Fix RLS policies to ensure all INSERT operations work correctly
-- This migration ensures that users with ADMIN or STAFF roles can insert data

-- Ensure get_my_role() function exists and works correctly
-- This function bypasses RLS to check the user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- Fix daily_box_entries INSERT policy
DROP POLICY IF EXISTS "Staff can insert daily box entries" ON public.daily_box_entries;
CREATE POLICY "Staff can insert daily box entries" ON public.daily_box_entries
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Fix daily_box_entries UPDATE policy
DROP POLICY IF EXISTS "Staff can update own entries" ON public.daily_box_entries;
CREATE POLICY "Staff can update own entries" ON public.daily_box_entries
  FOR UPDATE 
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Fix lottery_reports INSERT policy
DROP POLICY IF EXISTS "Staff can insert lottery reports" ON public.lottery_reports;
CREATE POLICY "Staff can insert lottery reports" ON public.lottery_reports
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Fix pos_reports INSERT policy
DROP POLICY IF EXISTS "Staff can insert POS reports" ON public.pos_reports;
CREATE POLICY "Staff can insert POS reports" ON public.pos_reports
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Fix players INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "Staff can manage players" ON public.players;
CREATE POLICY "Staff can manage players" ON public.players
  FOR ALL
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Fix player_transactions INSERT policy
DROP POLICY IF EXISTS "Staff can insert player transactions" ON public.player_transactions;
CREATE POLICY "Staff can insert player transactions" ON public.player_transactions
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Fix activated_books INSERT policy
DROP POLICY IF EXISTS "Staff can insert activated books" ON public.activated_books;
CREATE POLICY "Staff can insert activated books" ON public.activated_books
  FOR INSERT 
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Fix boxes INSERT/UPDATE/DELETE policies (Admin only)
DROP POLICY IF EXISTS "Admin can manage boxes" ON public.boxes;
CREATE POLICY "Admin can manage boxes" ON public.boxes
  FOR ALL
  USING (public.get_my_role() = 'ADMIN')
  WITH CHECK (public.get_my_role() = 'ADMIN');

-- Add helpful comment
COMMENT ON FUNCTION public.get_my_role() IS 'Returns the role of the current authenticated user. Returns NULL if user is not in public.users table.';
