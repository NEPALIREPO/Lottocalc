-- Fix sold calculation formula and make close_number nullable
-- Formula: IF(new_box_start IS NOT NULL,
--   open - COALESCE(close, 0) + new_box_start + 1 + CASE WHEN close IS NULL THEN 1 ELSE 0 END,
--   open - COALESCE(close, 0) + CASE WHEN close IS NULL THEN 1 ELSE 0 END
-- )

-- Make close_number nullable
ALTER TABLE public.daily_box_entries
  ALTER COLUMN close_number DROP NOT NULL;

-- Add new_box_start_number if not exists
ALTER TABLE public.daily_box_entries
  ADD COLUMN IF NOT EXISTS new_box_start_number INTEGER;

-- Drop and recreate sold_count with new formula
ALTER TABLE public.daily_box_entries DROP COLUMN IF EXISTS sold_count;
ALTER TABLE public.daily_box_entries
  ADD COLUMN sold_count INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN new_box_start_number IS NOT NULL THEN
        open_number - COALESCE(close_number, 0) + new_box_start_number + 1 + CASE WHEN close_number IS NULL THEN 1 ELSE 0 END
      ELSE
        open_number - COALESCE(close_number, 0) + CASE WHEN close_number IS NULL THEN 1 ELSE 0 END
    END
  ) STORED;

-- Update trigger function
CREATE OR REPLACE FUNCTION calculate_sold_amount()
RETURNS TRIGGER AS $$
DECLARE
  ticket_val DECIMAL(10, 2);
  sold_count_calc INTEGER;
BEGIN
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

-- Update continuity check to handle nullable close_number
CREATE OR REPLACE FUNCTION check_ticket_continuity()
RETURNS TRIGGER AS $$
DECLARE
  prev_close INTEGER;
  severity_level TEXT;
BEGIN
  -- Get previous day's close number (only if it exists)
  SELECT close_number INTO prev_close
  FROM public.daily_box_entries
  WHERE box_id = NEW.box_id
    AND date = NEW.date - INTERVAL '1 day'
    AND close_number IS NOT NULL
  ORDER BY date DESC
  LIMIT 1;

  -- If previous entry exists with close number and doesn't match today's open
  IF prev_close IS NOT NULL AND NEW.open_number IS NOT NULL AND prev_close != NEW.open_number THEN
    -- Determine severity
    IF ABS(NEW.open_number - prev_close) <= 5 THEN
      severity_level := 'warning';
    ELSIF ABS(NEW.open_number - prev_close) <= 20 THEN
      severity_level := 'error';
    ELSE
      severity_level := 'critical';
    END IF;

    -- Insert into continuity log
    INSERT INTO public.ticket_continuity_logs (
      date, box_id, prev_close, today_open, severity
    ) VALUES (
      NEW.date, NEW.box_id, prev_close, NEW.open_number, severity_level
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
