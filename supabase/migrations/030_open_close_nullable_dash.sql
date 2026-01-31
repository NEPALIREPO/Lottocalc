-- Allow open_number and close_number to be NULL when box is not refilled (denoted by "-" in UI).
-- Sold count/amount are 0 when open_number is NULL.

-- Make open_number nullable
ALTER TABLE public.daily_box_entries
  ALTER COLUMN open_number DROP NOT NULL;

-- Recreate sold_count generated column to handle NULL open_number (treat as 0 sold)
ALTER TABLE public.daily_box_entries DROP COLUMN IF EXISTS sold_count;
ALTER TABLE public.daily_box_entries
  ADD COLUMN sold_count INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN open_number IS NULL THEN 0
      WHEN new_box_start_number IS NOT NULL THEN
        open_number - COALESCE(close_number, 0) + new_box_start_number + 1 + CASE WHEN close_number IS NULL THEN 1 ELSE 0 END
      ELSE
        open_number - COALESCE(close_number, 0) + CASE WHEN close_number IS NULL THEN 1 ELSE 0 END
    END
  ) STORED;

-- Update trigger: when open_number is NULL, sold_amount = 0
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

  IF NEW.new_box_start_number IS NOT NULL THEN
    sold_count_calc := NEW.open_number - COALESCE(NEW.close_number, 0) + NEW.new_box_start_number + 1 +
                       CASE WHEN NEW.close_number IS NULL THEN 1 ELSE 0 END;
  ELSE
    sold_count_calc := NEW.open_number - COALESCE(NEW.close_number, 0) +
                       CASE WHEN NEW.close_number IS NULL THEN 1 ELSE 0 END;
  END IF;

  NEW.sold_amount := sold_count_calc * ticket_val;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
