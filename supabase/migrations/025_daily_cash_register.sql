-- Daily cash register: manual data entry for lottery cash at register and grocery cash at register per date.
-- Used in admin Reports generated fields (items 8 and 9).

CREATE TABLE IF NOT EXISTS public.daily_cash_register (
  date DATE PRIMARY KEY,
  lottery_cash_at_register DECIMAL(12, 2),
  grocery_cash_at_register DECIMAL(12, 2),
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.daily_cash_register IS 'Manual entry: lottery cash at register and grocery cash at register for daily report (pickup calculation).';
COMMENT ON COLUMN public.daily_cash_register.lottery_cash_at_register IS 'Lottery cash at register (data entry by staff/admin).';
COMMENT ON COLUMN public.daily_cash_register.grocery_cash_at_register IS 'Total grocery cash at register (data entry; can mirror or override POS report).';

ALTER TABLE public.daily_cash_register ENABLE ROW LEVEL SECURITY;

-- Admin and staff can read
CREATE POLICY "Authenticated users can read daily_cash_register"
  ON public.daily_cash_register FOR SELECT
  TO authenticated
  USING (true);

-- Admin and staff can insert/update (upsert by date)
CREATE POLICY "Staff can insert daily_cash_register"
  ON public.daily_cash_register FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

CREATE POLICY "Staff can update daily_cash_register"
  ON public.daily_cash_register FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

CREATE INDEX IF NOT EXISTS idx_daily_cash_register_date ON public.daily_cash_register(date);
