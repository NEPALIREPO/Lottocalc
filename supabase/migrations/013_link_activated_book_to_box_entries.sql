-- Link daily box entries to activated books
-- When an activated book exists for a box/date, the entry can reference it and use its start_ticket_number as new_box_start_number

ALTER TABLE public.daily_box_entries
  ADD COLUMN IF NOT EXISTS activated_book_id UUID REFERENCES public.activated_books(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_box_entries_activated_book_id ON public.daily_box_entries(activated_book_id);

COMMENT ON COLUMN public.daily_box_entries.activated_book_id IS 'References the activated book used for this date/box; new_box_start_number should match that book''s start_ticket_number';
