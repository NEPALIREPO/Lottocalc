-- Treat open "-" (NULL) as 0 in the formula so e.g. open=-, close=97, new box=99 → sold = 0-97+99+1 = 2
-- C2=new box, D2=open, E2=close. Excel: D2/E2/C2 "" or "-" → 0 in arithmetic.
-- =IF(C2<>"-", D2 - (E or 0) + (C or 0) + 1, D2 - (E or 0) + 1)

ALTER TABLE public.daily_box_entries DROP COLUMN IF EXISTS sold_count;
ALTER TABLE public.daily_box_entries
  ADD COLUMN sold_count INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN new_box_start_number IS NOT NULL THEN
        COALESCE(open_number, 0) - COALESCE(close_number, 0) + new_box_start_number + 1
      ELSE
        COALESCE(open_number, 0) - COALESCE(close_number, 0) + 1
    END
  ) STORED;

COMMENT ON COLUMN public.daily_box_entries.sold_count IS '=IF(C2<>"-", D2-(E or 0)+(C or 0)+1, D2-(E or 0)+1). D,E,C NULL/"-"→0.';

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
    sold_count_calc := open_val - close_val + NEW.new_box_start_number + 1;
  ELSE
    sold_count_calc := open_val - close_val + 1;
  END IF;

  SELECT ticket_value INTO ticket_val FROM public.boxes WHERE id = NEW.box_id;
  NEW.sold_amount := sold_count_calc * COALESCE(ticket_val, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE public.daily_box_entries SET updated_at = NOW();
