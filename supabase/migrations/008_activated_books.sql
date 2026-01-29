-- Activated books: when a new ticket book/roll is printed (0-based ticket numbers)
CREATE TABLE public.activated_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  box_id UUID NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  activated_date DATE NOT NULL,
  start_ticket_number INTEGER NOT NULL DEFAULT 0,
  ticket_count INTEGER NOT NULL,
  note TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activated_books_box_id ON public.activated_books(box_id);
CREATE INDEX idx_activated_books_activated_date ON public.activated_books(activated_date);

ALTER TABLE public.activated_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can insert activated books" ON public.activated_books
  FOR INSERT WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

CREATE POLICY "Authenticated users can read activated books" ON public.activated_books
  FOR SELECT USING (auth.role() = 'authenticated');
