-- Sold tickets calculation semantics:
--   C = new_box_start_number, D = open_number, E = close_number
--   0 is a valid value (1 ticket = ticket #0). NULL = "-" in UI = no ticket.
-- Formula: IF(C IS NOT NULL, D - COALESCE(E,0) + C + 1 + (E IS NULL ? 1 : 0), D - COALESCE(E,0) + (E IS NULL ? 1 : 0))
-- When D (open) is NULL → sold = 0 (box not refilled).

COMMENT ON COLUMN public.daily_box_entries.sold_count IS 'Tickets sold. 0 = valid (1 ticket); open/close NULL = "-" = no ticket. Formula: if new_box_start then open - coalesce(close,0) + new_box_start + 1 + (close null?1:0) else open - coalesce(close,0) + (close null?1:0). open NULL → 0.';

CREATE OR REPLACE FUNCTION calculate_sold_amount()
RETURNS TRIGGER AS $$
DECLARE
  ticket_val DECIMAL(10, 2);
  sold_count_calc INTEGER;
BEGIN
  -- open_number NULL = "-" = no ticket → sold = 0
  IF NEW.open_number IS NULL THEN
    NEW.sold_amount := 0;
    RETURN NEW;
  END IF;

  SELECT ticket_value INTO ticket_val
  FROM public.boxes
  WHERE id = NEW.box_id;

  -- 0 is valid (1 ticket); close_number NULL = "-" → COALESCE(close, 0), +1 when close null
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
