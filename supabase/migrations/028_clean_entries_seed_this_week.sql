-- Clean all daily box entries and submission records, then seed this week (Mon–Sun)
-- with placeholder rows (open 0, close 0) so you can see and edit results in the dashboard.

-- 1. Remove submission flags so dates are editable again
DELETE FROM public.daily_entry_submissions;

-- 2. Remove all daily box entries
DELETE FROM public.daily_box_entries;

-- 3. Remove all activated books
DELETE FROM public.activated_books;

-- 4. Seed this week (Monday–Sunday) with one row per (date, box), open 0 / close 0
-- Uses first user in public.users as created_by so rows are valid.
DO $$
DECLARE
  uid UUID;
  week_start DATE;
BEGIN
  SELECT id INTO uid FROM public.users LIMIT 1;
  week_start := date_trunc('week', current_date)::date;

  IF uid IS NOT NULL THEN
    INSERT INTO public.daily_box_entries (date, box_id, open_number, close_number, created_by)
    SELECT d::date, b.id, 0, 0, uid
    FROM generate_series(week_start, week_start + 6, '1 day'::interval) AS d,
         (SELECT id FROM public.boxes ORDER BY box_number) AS b;
  END IF;
END $$;
