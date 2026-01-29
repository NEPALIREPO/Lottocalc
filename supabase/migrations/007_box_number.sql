-- Add box_number so staff can enter by box number (Box 1, Box 2, ...)
ALTER TABLE public.boxes
  ADD COLUMN IF NOT EXISTS box_number INTEGER UNIQUE;

CREATE INDEX IF NOT EXISTS idx_boxes_box_number ON public.boxes(box_number);

-- Backfill: assign numbers by name order for existing rows
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM public.boxes
  WHERE box_number IS NULL
)
UPDATE public.boxes b
SET box_number = numbered.rn
FROM numbered
WHERE b.id = numbered.id;
