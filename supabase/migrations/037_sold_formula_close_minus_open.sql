-- Update sold formula: regular = close - open; new book = new_book + open - close
-- Null ("-") values are treated as 0.

ALTER TABLE public.daily_box_entries DROP COLUMN IF EXISTS sold_count;
ALTER TABLE public.daily_box_entries
  ADD COLUMN sold_count INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN new_box_start_number IS NOT NULL THEN
        new_box_start_number + COALESCE(open_number, 0) - COALESCE(close_number, 0)
      ELSE
        COALESCE(close_number, 0) - COALESCE(open_number, 0)
    END
  ) STORED;

COMMENT ON COLUMN public.daily_box_entries.sold_count IS
  '=IF(new_book IS NOT NULL, new_book + (open or 0) - (close or 0), (close or 0) - (open or 0)). "-" -> 0.';

CREATE OR REPLACE FUNCTION calculate_sold_amount()
RETURNS TRIGGER AS $$
DECLARE
  ticket_val DECIMAL(10, 2);
  open_val INTEGER;
  close_val INTEGER;
  sold_count_calc INTEGER;
BEGIN
  open_val := COALESCE(NEW.open_number, 0);
  close_val := COALESCE(NEW.close_number, 0);

  IF NEW.new_box_start_number IS NOT NULL THEN
    sold_count_calc := NEW.new_box_start_number + open_val - close_val;
  ELSE
    sold_count_calc := close_val - open_val;
  END IF;

  SELECT ticket_value INTO ticket_val FROM public.boxes WHERE id = NEW.box_id;
  NEW.sold_amount := sold_count_calc * COALESCE(ticket_val, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE public.daily_box_entries SET updated_at = NOW();
