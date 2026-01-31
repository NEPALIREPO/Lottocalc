-- Total tickets sold: exact Excel formula
-- C2 = new box start (activated), D2 = opening, E2 = closing
-- =IF(C2<>"-",
--   D2 - IF(OR(E2="",E2="-"),0,E2) + IF(OR(C2="",C2="-"),0,C2) + 1,
--   D2 - IF(OR(E2="",E2="-"),0,E2) + 1
-- )
-- When open (D2) is NULL/"-" → sold = 0.

ALTER TABLE public.daily_box_entries DROP COLUMN IF EXISTS sold_count;
ALTER TABLE public.daily_box_entries
  ADD COLUMN sold_count INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN open_number IS NULL THEN 0
      WHEN new_box_start_number IS NOT NULL THEN
        open_number - COALESCE(close_number, 0) + new_box_start_number + 1
      ELSE
        open_number - COALESCE(close_number, 0) + 1
    END
  ) STORED;

COMMENT ON COLUMN public.daily_box_entries.sold_count IS '=IF(C2<>"-", D2-IF(OR(E2="",E2="-"),0,E2)+IF(OR(C2="",C2="-"),0,C2)+1, D2-IF(OR(E2="",E2="-"),0,E2)+1). C=new box, D=open, E=close. open NULL→0.';

CREATE OR REPLACE FUNCTION calculate_sold_amount()
RETURNS TRIGGER AS $$
DECLARE
  ticket_val DECIMAL(10, 2);
  sold_count_calc INTEGER;
  close_val INTEGER;
BEGIN
  IF NEW.open_number IS NULL THEN
    NEW.sold_amount := 0;
    RETURN NEW;
  END IF;

  SELECT ticket_value INTO ticket_val FROM public.boxes WHERE id = NEW.box_id;
  close_val := COALESCE(NEW.close_number, 0);

  IF NEW.new_box_start_number IS NOT NULL THEN
    sold_count_calc := NEW.open_number - close_val + NEW.new_box_start_number + 1;
  ELSE
    sold_count_calc := NEW.open_number - close_val + 1;
  END IF;

  NEW.sold_amount := sold_count_calc * COALESCE(ticket_val, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE public.daily_box_entries SET updated_at = NOW();
