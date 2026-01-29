-- Fix sold formula: sold = open - close (tickets 0-based)
-- For existing DBs that had sold_count = close - open

-- Update trigger function
CREATE OR REPLACE FUNCTION calculate_sold_amount()
RETURNS TRIGGER AS $$
DECLARE
  ticket_val DECIMAL(10, 2);
BEGIN
  SELECT ticket_value INTO ticket_val
  FROM public.boxes
  WHERE id = NEW.box_id;

  NEW.sold_amount := (NEW.open_number - NEW.close_number) * ticket_val;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate sold_count as generated column (open - close) if it exists as (close - open)
-- PostgreSQL: drop and add column
ALTER TABLE public.daily_box_entries DROP COLUMN IF EXISTS sold_count;
ALTER TABLE public.daily_box_entries
  ADD COLUMN sold_count INTEGER GENERATED ALWAYS AS (open_number - close_number) STORED;
