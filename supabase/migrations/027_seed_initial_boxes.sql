-- Seed boxes 1-86 with ticket values and categories per spec:
-- 1-6: $30 high, 7-16: $20 high, 17-40: $10 regular, 41-57: $5 regular,
-- 58-68: $2 regular, 69-74: $1 regular, 75-76: $5 seasonal, 77-80: $10 seasonal,
-- 81-86: $50 high

-- Allow auto-assign up to 86 so box numbers 81-86 are valid
CREATE OR REPLACE FUNCTION auto_assign_box_number()
RETURNS TRIGGER AS $$
DECLARE
  next_box_num INTEGER;
BEGIN
  IF NEW.box_number IS NULL THEN
    SELECT COALESCE(MAX(box_number), 0) + 1 INTO next_box_num
    FROM public.boxes
    WHERE box_number IS NOT NULL;

    IF next_box_num > 86 THEN
      RAISE EXCEPTION 'Maximum box number is 86';
    END IF;

    NEW.box_number := next_box_num;
  END IF;

  IF NEW.box_number IS NOT NULL AND (NEW.name IS NULL OR NEW.name = '') THEN
    NEW.name := 'Box no ' || NEW.box_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Upsert boxes 1-86 with correct ticket_value and category
DO $$
BEGIN
  -- 1-6: $30, high
  FOR i IN 1..6 LOOP
    INSERT INTO public.boxes (box_number, name, ticket_value, category)
    VALUES (i, 'Box no ' || i, 30.00, 'high')
    ON CONFLICT (box_number) DO UPDATE SET
      name = EXCLUDED.name,
      ticket_value = EXCLUDED.ticket_value,
      category = EXCLUDED.category;
  END LOOP;

  -- 7-16: $20, high
  FOR i IN 7..16 LOOP
    INSERT INTO public.boxes (box_number, name, ticket_value, category)
    VALUES (i, 'Box no ' || i, 20.00, 'high')
    ON CONFLICT (box_number) DO UPDATE SET
      name = EXCLUDED.name,
      ticket_value = EXCLUDED.ticket_value,
      category = EXCLUDED.category;
  END LOOP;

  -- 17-40: $10, regular
  FOR i IN 17..40 LOOP
    INSERT INTO public.boxes (box_number, name, ticket_value, category)
    VALUES (i, 'Box no ' || i, 10.00, 'regular')
    ON CONFLICT (box_number) DO UPDATE SET
      name = EXCLUDED.name,
      ticket_value = EXCLUDED.ticket_value,
      category = EXCLUDED.category;
  END LOOP;

  -- 41-57: $5, regular
  FOR i IN 41..57 LOOP
    INSERT INTO public.boxes (box_number, name, ticket_value, category)
    VALUES (i, 'Box no ' || i, 5.00, 'regular')
    ON CONFLICT (box_number) DO UPDATE SET
      name = EXCLUDED.name,
      ticket_value = EXCLUDED.ticket_value,
      category = EXCLUDED.category;
  END LOOP;

  -- 58-68: $2, regular
  FOR i IN 58..68 LOOP
    INSERT INTO public.boxes (box_number, name, ticket_value, category)
    VALUES (i, 'Box no ' || i, 2.00, 'regular')
    ON CONFLICT (box_number) DO UPDATE SET
      name = EXCLUDED.name,
      ticket_value = EXCLUDED.ticket_value,
      category = EXCLUDED.category;
  END LOOP;

  -- 69-74: $1, regular
  FOR i IN 69..74 LOOP
    INSERT INTO public.boxes (box_number, name, ticket_value, category)
    VALUES (i, 'Box no ' || i, 1.00, 'regular')
    ON CONFLICT (box_number) DO UPDATE SET
      name = EXCLUDED.name,
      ticket_value = EXCLUDED.ticket_value,
      category = EXCLUDED.category;
  END LOOP;

  -- 75-76: $5, seasonal
  FOR i IN 75..76 LOOP
    INSERT INTO public.boxes (box_number, name, ticket_value, category)
    VALUES (i, 'Box no ' || i, 5.00, 'seasonal')
    ON CONFLICT (box_number) DO UPDATE SET
      name = EXCLUDED.name,
      ticket_value = EXCLUDED.ticket_value,
      category = EXCLUDED.category;
  END LOOP;

  -- 77-80: $10, seasonal
  FOR i IN 77..80 LOOP
    INSERT INTO public.boxes (box_number, name, ticket_value, category)
    VALUES (i, 'Box no ' || i, 10.00, 'seasonal')
    ON CONFLICT (box_number) DO UPDATE SET
      name = EXCLUDED.name,
      ticket_value = EXCLUDED.ticket_value,
      category = EXCLUDED.category;
  END LOOP;

  -- 81-86: $50, high
  FOR i IN 81..86 LOOP
    INSERT INTO public.boxes (box_number, name, ticket_value, category)
    VALUES (i, 'Box no ' || i, 50.00, 'high')
    ON CONFLICT (box_number) DO UPDATE SET
      name = EXCLUDED.name,
      ticket_value = EXCLUDED.ticket_value,
      category = EXCLUDED.category;
  END LOOP;
END $$;

COMMENT ON FUNCTION auto_assign_box_number() IS 'Automatically assigns the next available box number (1-86) when inserting a box without a box_number';
