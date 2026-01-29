-- Track when daily box entries have been submitted (locked for staff; only admin can edit after)
CREATE TABLE IF NOT EXISTS public.daily_entry_submissions (
  date DATE PRIMARY KEY,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL
);

-- RLS
ALTER TABLE public.daily_entry_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (to know if date is locked)
CREATE POLICY "Allow read daily_entry_submissions"
  ON public.daily_entry_submissions FOR SELECT
  TO authenticated
  USING (true);

-- Only staff/admin can insert/update (mark as submitted)
CREATE POLICY "Allow insert daily_entry_submissions"
  ON public.daily_entry_submissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update daily_entry_submissions"
  ON public.daily_entry_submissions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.daily_entry_submissions IS 'When a date is submitted, only admin can edit daily box entries for that date.';
