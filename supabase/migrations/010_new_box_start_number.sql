-- Add new_box_start_number to daily_box_entries for sold calculation
-- Formula: IF(new_box_start IS NOT NULL,
--   open - IF(close IS NULL, 0, close) + new_box_start + 1 + IF(close IS NULL, 1, 0),
--   open - IF(close IS NULL, 0, close) + IF(close IS NULL, 1, 0)
-- )

ALTER TABLE public.daily_box_entries
  ADD COLUMN IF NOT EXISTS new_box_start_number INTEGER;

COMMENT ON COLUMN public.daily_box_entries.new_box_start_number IS 'Start ticket number of new activated book for this date/box (C in formula). If NULL, no new box was activated.';
