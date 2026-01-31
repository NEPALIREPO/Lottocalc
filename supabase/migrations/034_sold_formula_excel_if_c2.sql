-- Tickets sold per user formula (C=new box start, D=open, E=close; "-" = null):
-- IF(C<>"-", D - (E or 0) + (C or 0) + 1, D - (E or 0) + 1)
-- When open (D) is NULL ("-") → sold = 0.
-- NOTE: Table daily_box_entries is created in 001_initial_schema.sql. Run migrations in order (e.g. npx supabase migration up).

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

COMMENT ON COLUMN public.daily_box_entries.sold_count IS 'Tickets sold: IF(C<>"-", D-(E or 0)+(C or 0)+1, D-(E or 0)+1). open NULL → 0.';

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
    sold_count_calc := NEW.open_number - COALESCE(NEW.close_number, 0) + NEW.new_box_start_number + 1;
  ELSE
    sold_count_calc := NEW.open_number - COALESCE(NEW.close_number, 0) + 1;
  END IF;
  NEW.sold_amount := sold_count_calc * ticket_val;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recalculate sold_amount for existing rows
UPDATE public.daily_box_entries SET updated_at = NOW();
