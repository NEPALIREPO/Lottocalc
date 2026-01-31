-- Total sold = (opening number + new book) - closing number
-- When open is NULL ("-") → sold = 0. Null close/new_book treated as 0 in the sum.

ALTER TABLE public.daily_box_entries DROP COLUMN IF EXISTS sold_count;
ALTER TABLE public.daily_box_entries
  ADD COLUMN sold_count INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN open_number IS NULL THEN 0
      ELSE open_number + COALESCE(new_box_start_number, 0) - COALESCE(close_number, 0)
    END
  ) STORED;

COMMENT ON COLUMN public.daily_box_entries.sold_count IS 'Tickets sold = (opening + new book) - closing. 0 = valid; NULL = "-" = no ticket. open NULL → 0.';

CREATE OR REPLACE FUNCTION calculate_sold_amount()
RETURNS TRIGGER AS $$
DECLARE
  ticket_val DECIMAL(10, 2);
  sold_count_calc INTEGER;
BEGIN
  IF NEW.open_number IS NULL THEN
    NEW.sold_amount := 0;
    RETURN NEW;
  END IF;

  SELECT ticket_value INTO ticket_val
  FROM public.boxes
  WHERE id = NEW.box_id;

  -- Total sold = (opening + new book) - closing
  sold_count_calc := NEW.open_number + COALESCE(NEW.new_box_start_number, 0) - COALESCE(NEW.close_number, 0);
  NEW.sold_amount := sold_count_calc * ticket_val;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
