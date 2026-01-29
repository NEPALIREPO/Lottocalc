-- Seed data for development/testing
-- Note: Boxes 1-80 will be created by migration 012 with standardized names
-- This seed file is kept for reference but boxes should use "Box no X" format

-- Insert sample boxes with standardized naming (Box no 1, Box no 2, etc.)
INSERT INTO public.boxes (box_number, name, ticket_value, category) VALUES
  (1, 'Box no 1', 1.00, 'regular'),
  (2, 'Box no 2', 2.00, 'regular'),
  (3, 'Box no 3', 5.00, 'high'),
  (4, 'Box no 4', 10.00, 'high'),
  (5, 'Box no 5', 20.00, 'high'),
  (6, 'Box no 6', 5.00, 'seasonal')
ON CONFLICT (box_number) DO UPDATE SET name = EXCLUDED.name;

-- Note: Users will be created through Supabase Auth UI
-- You'll need to manually create users and then update their role in the users table
