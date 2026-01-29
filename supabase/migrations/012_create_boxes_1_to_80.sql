-- Create boxes numbered 1 to 80 with auto-adjustment
-- This ensures sequential box numbers from 1 to 80

-- Function to auto-assign box_number if not provided
CREATE OR REPLACE FUNCTION auto_assign_box_number()
RETURNS TRIGGER AS $$
DECLARE
  next_box_num INTEGER;
BEGIN
  -- If box_number is not provided, assign the next available number
  IF NEW.box_number IS NULL THEN
    SELECT COALESCE(MAX(box_number), 0) + 1 INTO next_box_num
    FROM public.boxes
    WHERE box_number IS NOT NULL;
    
    -- Ensure we don't exceed 80
    IF next_box_num > 80 THEN
      RAISE EXCEPTION 'Maximum box number is 80';
    END IF;
    
    NEW.box_number := next_box_num;
  END IF;
  
  -- Auto-assign standardized name if name is not provided
  IF NEW.box_number IS NOT NULL AND (NEW.name IS NULL OR NEW.name = '') THEN
    NEW.name := 'Box no ' || NEW.box_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-assign box numbers
DROP TRIGGER IF EXISTS trigger_auto_assign_box_number ON public.boxes;
CREATE TRIGGER trigger_auto_assign_box_number
  BEFORE INSERT ON public.boxes
  FOR EACH ROW
  WHEN (NEW.box_number IS NULL)
  EXECUTE FUNCTION auto_assign_box_number();

-- First, update all existing boxes to have standardized names
UPDATE public.boxes
SET name = 'Box no ' || box_number
WHERE box_number IS NOT NULL AND box_number BETWEEN 1 AND 80;

-- Create boxes 1 to 80 if they don't exist with standardized names
DO $$
DECLARE
  i INTEGER;
  box_name TEXT;
BEGIN
  FOR i IN 1..80 LOOP
    -- Standardized name format: "Box no 1", "Box no 2", etc.
    box_name := 'Box no ' || i;
    
    -- Insert box if it doesn't exist, or update name if box_number exists but name is different
    INSERT INTO public.boxes (box_number, name, ticket_value, category)
    VALUES (i, box_name, 1.00, 'regular')
    ON CONFLICT (box_number) 
    DO UPDATE SET name = EXCLUDED.name;
    
    -- Also ensure name matches if box exists with different name
    UPDATE public.boxes
    SET name = box_name
    WHERE box_number = i AND name != box_name;
  END LOOP;
END $$;

COMMENT ON FUNCTION auto_assign_box_number() IS 'Automatically assigns the next available box number (1-80) when inserting a box without a box_number';
