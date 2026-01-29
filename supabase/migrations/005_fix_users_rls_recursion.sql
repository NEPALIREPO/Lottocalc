-- Fix infinite recursion in RLS policies on public.users (42P17)
-- Policies that did EXISTS (SELECT 1 FROM public.users ...) caused recursion.
-- Use a SECURITY DEFINER function get_my_role() instead.

-- 1. Create helper function (bypasses RLS when run)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. Fix users table: drop recursive policy and recreate
DROP POLICY IF EXISTS "Staff can read all users" ON public.users;
CREATE POLICY "Staff can read all users" ON public.users
  FOR SELECT USING (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- 3. Fix boxes
DROP POLICY IF EXISTS "Admin can manage boxes" ON public.boxes;
CREATE POLICY "Admin can manage boxes" ON public.boxes
  FOR ALL USING (public.get_my_role() = 'ADMIN');

-- 4. Fix daily_box_entries
DROP POLICY IF EXISTS "Staff can insert daily box entries" ON public.daily_box_entries;
CREATE POLICY "Staff can insert daily box entries" ON public.daily_box_entries
  FOR INSERT WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

DROP POLICY IF EXISTS "Staff can update own entries" ON public.daily_box_entries;
CREATE POLICY "Staff can update own entries" ON public.daily_box_entries
  FOR UPDATE USING (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- 5. Fix lottery_reports
DROP POLICY IF EXISTS "Staff can insert lottery reports" ON public.lottery_reports;
CREATE POLICY "Staff can insert lottery reports" ON public.lottery_reports
  FOR INSERT WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- 6. Fix pos_reports
DROP POLICY IF EXISTS "Staff can insert POS reports" ON public.pos_reports;
CREATE POLICY "Staff can insert POS reports" ON public.pos_reports
  FOR INSERT WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- 7. Fix players (explicit WITH CHECK for INSERT)
DROP POLICY IF EXISTS "Staff can manage players" ON public.players;
CREATE POLICY "Staff can manage players" ON public.players
  FOR ALL
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- 8. Fix player_transactions
DROP POLICY IF EXISTS "Staff can insert player transactions" ON public.player_transactions;
CREATE POLICY "Staff can insert player transactions" ON public.player_transactions
  FOR INSERT WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));
