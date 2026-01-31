-- Add manual entry fields for Instant Report 50 (Special Report 50)
-- Net Sales = Total Sales - Discount - Cancels - Free Bets (computed in app)
-- Net Due = Net Sales - Commission - Cashes - Cash Bonus + Service Fee (computed in app)

ALTER TABLE public.lottery_reports
  ADD COLUMN IF NOT EXISTS season_tkts DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS discount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS cancels DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS free_bets DECIMAL(10, 2);

COMMENT ON COLUMN public.lottery_reports.season_tkts IS 'Season TKTS (Special Report 50 manual entry)';
COMMENT ON COLUMN public.lottery_reports.discount IS 'Discount (Special Report 50)';
COMMENT ON COLUMN public.lottery_reports.cancels IS 'Cancels (Special Report 50)';
COMMENT ON COLUMN public.lottery_reports.free_bets IS 'Free Bets (Special Report 50)';
