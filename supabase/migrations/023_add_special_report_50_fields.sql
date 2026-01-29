-- Add fields for Special Report 50
-- Special Report 50 includes: event count/value, total sales, cash count/value, bonuses, adjustments, service fee

ALTER TABLE public.lottery_reports
  ADD COLUMN IF NOT EXISTS event_count INTEGER,
  ADD COLUMN IF NOT EXISTS event_value DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS total_sales DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS cash_count INTEGER,
  ADD COLUMN IF NOT EXISTS cash_value DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS cash_bonus DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS claims_bonus DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS adjustments DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS service_fee DECIMAL(10, 2);

COMMENT ON COLUMN public.lottery_reports.event_count IS 'Count of events (Special Report 50)';
COMMENT ON COLUMN public.lottery_reports.event_value IS 'Value of events - right side of count row (Special Report 50)';
COMMENT ON COLUMN public.lottery_reports.total_sales IS 'Number of tickets sold online (income) - Special Report 50';
COMMENT ON COLUMN public.lottery_reports.cash_count IS 'Count of cashes - left side (Special Report 50)';
COMMENT ON COLUMN public.lottery_reports.cash_value IS 'Value of cashes - right side (outgoing amount) (Special Report 50)';
COMMENT ON COLUMN public.lottery_reports.cash_bonus IS 'Cash bonus (Special Report 50)';
COMMENT ON COLUMN public.lottery_reports.claims_bonus IS 'Claims bonus (Special Report 50)';
COMMENT ON COLUMN public.lottery_reports.adjustments IS 'Adjustments (Special Report 50)';
COMMENT ON COLUMN public.lottery_reports.service_fee IS 'Service fee (Special Report 50)';
