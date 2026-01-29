-- Player transactions: support play (games), payment, and win
-- Balance = sum(play) - sum(payment) - sum(win)

ALTER TABLE public.player_transactions
  ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'play'
    CHECK (transaction_type IN ('play', 'payment', 'win'));

ALTER TABLE public.player_transactions
  ADD COLUMN IF NOT EXISTS game_details TEXT;

COMMENT ON COLUMN public.player_transactions.transaction_type IS 'play = amount owed from games; payment = amount player paid; win = amount player won';
COMMENT ON COLUMN public.player_transactions.game_details IS 'Optional: games played (e.g. "3x $2 scratch, 2x $5 online")';
