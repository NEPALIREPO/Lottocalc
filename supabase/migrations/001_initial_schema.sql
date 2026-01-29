-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'STAFF')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Boxes table (box_number = staff reference: Box 1, Box 2, ...)
CREATE TABLE public.boxes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  box_number INTEGER UNIQUE,
  name TEXT NOT NULL UNIQUE,
  ticket_value DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('regular', 'high', 'seasonal')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_boxes_box_number ON public.boxes(box_number);

-- Function to auto-assign box_number if not provided (1-80)
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
CREATE TRIGGER trigger_auto_assign_box_number
  BEFORE INSERT ON public.boxes
  FOR EACH ROW
  WHEN (NEW.box_number IS NULL)
  EXECUTE FUNCTION auto_assign_box_number();

-- Daily box entries
CREATE TABLE public.daily_box_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  box_id UUID NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  open_number INTEGER NOT NULL,
  close_number INTEGER,
  new_box_start_number INTEGER,
  sold_count INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN new_box_start_number IS NOT NULL THEN
        open_number - COALESCE(close_number, 0) + new_box_start_number + 1 + CASE WHEN close_number IS NULL THEN 1 ELSE 0 END
      ELSE
        open_number - COALESCE(close_number, 0) + CASE WHEN close_number IS NULL THEN 1 ELSE 0 END
    END
  ) STORED,
  sold_amount DECIMAL(10, 2),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, box_id)
);

-- Ticket continuity logs
CREATE TABLE public.ticket_continuity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  box_id UUID NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  prev_close INTEGER NOT NULL,
  today_open INTEGER NOT NULL,
  difference INTEGER GENERATED ALWAYS AS (today_open - prev_close) STORED,
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'error', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lottery reports (Instant Report 34, Special Report 50)
CREATE TABLE public.lottery_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('instant_34', 'special_50')),
  instant_ticket_count INTEGER,
  instant_total DECIMAL(10, 2),
  net_sales DECIMAL(10, 2),
  commission DECIMAL(10, 2),
  net_due DECIMAL(10, 2),
  raw_image_url TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, report_type)
);

-- POS reports
CREATE TABLE public.pos_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  grocery_total DECIMAL(10, 2) NOT NULL,
  cash DECIMAL(10, 2) NOT NULL,
  card DECIMAL(10, 2) NOT NULL,
  raw_image_url TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player transactions (play = games owed, payment = paid, win = won)
CREATE TABLE public.player_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL DEFAULT 'play' CHECK (transaction_type IN ('play', 'payment', 'win')),
  amount DECIMAL(10, 2) NOT NULL,
  game_details TEXT,
  note TEXT,
  date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activated books (new ticket book/roll printed; tickets 0-based)
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

-- Indexes for performance
CREATE INDEX idx_daily_box_entries_date ON public.daily_box_entries(date);
CREATE INDEX idx_daily_box_entries_box_id ON public.daily_box_entries(box_id);
CREATE INDEX idx_ticket_continuity_logs_date ON public.ticket_continuity_logs(date);
CREATE INDEX idx_ticket_continuity_logs_box_id ON public.ticket_continuity_logs(box_id);
CREATE INDEX idx_lottery_reports_date ON public.lottery_reports(date);
CREATE INDEX idx_pos_reports_date ON public.pos_reports(date);
CREATE INDEX idx_player_transactions_player_id ON public.player_transactions(player_id);
CREATE INDEX idx_player_transactions_date ON public.player_transactions(date);

-- RLS helper: get current user's role without triggering RLS recursion on public.users
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_box_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_continuity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activated_books ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Staff and Admin can read all users (use get_my_role() to avoid recursion)
CREATE POLICY "Staff can read all users" ON public.users
  FOR SELECT USING (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Boxes: Everyone authenticated can read
CREATE POLICY "Authenticated users can read boxes" ON public.boxes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin can manage boxes
CREATE POLICY "Admin can manage boxes" ON public.boxes
  FOR ALL USING (public.get_my_role() = 'ADMIN');

-- Daily box entries: Staff can insert/update, Admin can read all
CREATE POLICY "Staff can insert daily box entries" ON public.daily_box_entries
  FOR INSERT WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

CREATE POLICY "Staff can update own entries" ON public.daily_box_entries
  FOR UPDATE USING (public.get_my_role() IN ('ADMIN', 'STAFF'));

CREATE POLICY "Authenticated users can read daily box entries" ON public.daily_box_entries
  FOR SELECT USING (auth.role() = 'authenticated');

-- Ticket continuity logs: Read only for authenticated
CREATE POLICY "Authenticated users can read continuity logs" ON public.ticket_continuity_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Lottery reports: Staff can insert/update, Admin can read all
CREATE POLICY "Staff can insert lottery reports" ON public.lottery_reports
  FOR INSERT WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

CREATE POLICY "Authenticated users can read lottery reports" ON public.lottery_reports
  FOR SELECT USING (auth.role() = 'authenticated');

-- POS reports: Staff can insert/update, Admin can read all
CREATE POLICY "Staff can insert POS reports" ON public.pos_reports
  FOR INSERT WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

CREATE POLICY "Authenticated users can read POS reports" ON public.pos_reports
  FOR SELECT USING (auth.role() = 'authenticated');

-- Players: Staff can manage, Admin can read all
CREATE POLICY "Staff can manage players" ON public.players
  FOR ALL
  USING (public.get_my_role() IN ('ADMIN', 'STAFF'))
  WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

-- Player transactions: Staff can insert, Admin can read all
CREATE POLICY "Staff can insert player transactions" ON public.player_transactions
  FOR INSERT WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

CREATE POLICY "Authenticated users can read player transactions" ON public.player_transactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can insert activated books" ON public.activated_books
  FOR INSERT WITH CHECK (public.get_my_role() IN ('ADMIN', 'STAFF'));

CREATE POLICY "Authenticated users can read activated books" ON public.activated_books
  FOR SELECT USING (auth.role() = 'authenticated');

-- Function to calculate sold_amount
CREATE OR REPLACE FUNCTION calculate_sold_amount()
RETURNS TRIGGER AS $$
DECLARE
  ticket_val DECIMAL(10, 2);
  sold_count_calc INTEGER;
BEGIN
  -- Get ticket value from boxes table
  SELECT ticket_value INTO ticket_val
  FROM public.boxes
  WHERE id = NEW.box_id;

  -- Calculate sold_count using formula:
  -- IF(new_box_start IS NOT NULL,
  --   open - COALESCE(close, 0) + new_box_start + 1 + CASE WHEN close IS NULL THEN 1 ELSE 0 END,
  --   open - COALESCE(close, 0) + CASE WHEN close IS NULL THEN 1 ELSE 0 END
  -- )
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

-- Function to check ticket continuity
CREATE OR REPLACE FUNCTION check_ticket_continuity()
RETURNS TRIGGER AS $$
DECLARE
  prev_close INTEGER;
  severity_level TEXT;
BEGIN
  -- Get previous day's close number
  SELECT close_number INTO prev_close
  FROM public.daily_box_entries
  WHERE box_id = NEW.box_id
    AND date = NEW.date - INTERVAL '1 day'
  ORDER BY date DESC
  LIMIT 1;

  -- If previous entry exists and has a close number, check continuity
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

-- Trigger to calculate sold_amount
CREATE TRIGGER calculate_sold_amount_trigger
  BEFORE INSERT OR UPDATE ON public.daily_box_entries
  FOR EACH ROW
  EXECUTE PROCEDURE calculate_sold_amount();

-- Trigger for ticket continuity check
CREATE TRIGGER ticket_continuity_check
  AFTER INSERT OR UPDATE ON public.daily_box_entries
  FOR EACH ROW
  EXECUTE PROCEDURE check_ticket_continuity();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_boxes_updated_at BEFORE UPDATE ON public.boxes
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_daily_box_entries_updated_at BEFORE UPDATE ON public.daily_box_entries
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_lottery_reports_updated_at BEFORE UPDATE ON public.lottery_reports
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_pos_reports_updated_at BEFORE UPDATE ON public.pos_reports
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
