-- Fix RLS for report uploads (lottery_reports and pos_reports)
-- The upload flow: image upload -> OCR -> save to lottery_reports or pos_reports
-- We need both INSERT and UPDATE policies because createLotteryReport/createPOSReport use UPSERT

-- Ensure get_my_role() exists
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;

-- ========== lottery_reports ==========
-- INSERT (for new rows)
DROP POLICY IF EXISTS "Staff can insert lottery reports" ON public.lottery_reports;
CREATE POLICY "Staff can insert lottery reports" ON public.lottery_reports
  FOR INSERT
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- UPDATE (required for upsert when row already exists for date+report_type)
DROP POLICY IF EXISTS "Staff can update lottery reports" ON public.lottery_reports;
CREATE POLICY "Staff can update lottery reports" ON public.lottery_reports
  FOR UPDATE
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- ========== pos_reports ==========
-- INSERT (for new rows)
DROP POLICY IF EXISTS "Staff can insert POS reports" ON public.pos_reports;
CREATE POLICY "Staff can insert POS reports" ON public.pos_reports
  FOR INSERT
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- UPDATE (required for upsert when row already exists for date)
DROP POLICY IF EXISTS "Staff can update POS reports" ON public.pos_reports;
CREATE POLICY "Staff can update POS reports" ON public.pos_reports
  FOR UPDATE
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- ========== Ensure staff user exists (critical for get_my_role()) ==========
INSERT INTO public.users (id, name, role)
SELECT id, 'staff', 'STAFF'
FROM auth.users
WHERE email = 'staff@k2market.com'
ON CONFLICT (id) DO UPDATE
SET role = 'STAFF', name = 'staff', updated_at = NOW();

INSERT INTO public.users (id, name, role)
SELECT id, 'admin', 'ADMIN'
FROM auth.users
WHERE email = 'admin@admin.com'
ON CONFLICT (id) DO UPDATE
SET role = 'ADMIN', name = 'admin', updated_at = NOW();
