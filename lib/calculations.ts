import { createClient } from '@/lib/supabase/server';

export interface DailySummary {
  date: string;
  scratchSales: number;
  onlineSales: number;
  grocerySales: number;
  lotteryCashes: number;
  playerBalance: number;
  expectedCash: number;
}

export async function calculateDailySummary(date: Date): Promise<DailySummary> {
  const supabase = await createClient();
  const dateStr = date.toISOString().split('T')[0];

  // Get scratch sales (sum of all box sold_amount)
  const { data: boxEntries } = await supabase
    .from('daily_box_entries')
    .select('sold_amount')
    .eq('date', dateStr);

  const scratchSales = boxEntries?.reduce((sum, entry) => sum + (entry.sold_amount || 0), 0) || 0;

  // Get online sales (from lottery reports - net_sales)
  const { data: lotteryReports } = await supabase
    .from('lottery_reports')
    .select('net_sales, net_due')
    .eq('date', dateStr);

  const onlineSales = lotteryReports?.reduce((sum, report) => sum + (report.net_sales || 0), 0) || 0;

  // Get grocery sales (from POS reports)
  const { data: posReport } = await supabase
    .from('pos_reports')
    .select('grocery_total')
    .eq('date', dateStr)
    .single();

  const grocerySales = posReport?.grocery_total || 0;

  // Get lottery cashes (from lottery reports - net_due, which represents what we owe)
  const lotteryCashes = lotteryReports?.reduce((sum, report) => sum + (report.net_due || 0), 0) || 0;

  // Player activity for the day: play (owed) - payment (cash in) - win (cash out)
  const { data: playerTransactions } = await supabase
    .from('player_transactions')
    .select('transaction_type, amount')
    .eq('date', dateStr);

  let playerPayments = 0;
  let playerWins = 0;
  let playerPlays = 0;
  playerTransactions?.forEach((txn: { transaction_type?: string; amount?: number }) => {
    const amt = txn.amount ?? 0;
    const type = txn.transaction_type ?? 'play';
    if (type === 'play') playerPlays += amt;
    else if (type === 'payment') playerPayments += amt;
    else if (type === 'win') playerWins += amt;
  });
  const playerBalance = playerPlays - playerPayments - playerWins; // net change in what players owe

  // Expected cash: scratch + online + grocery - lottery_cashes + player_payments - player_wins
  const expectedCash =
    scratchSales + onlineSales + grocerySales - lotteryCashes + playerPayments - playerWins;

  return {
    date: dateStr,
    scratchSales,
    onlineSales,
    grocerySales,
    lotteryCashes,
    playerBalance,
    expectedCash,
  };
}

export async function calculateWeeklySummary(startDate: Date): Promise<DailySummary[]> {
  const summaries: DailySummary[] = [];
  const currentDate = new Date(startDate);

  for (let i = 0; i < 7; i++) {
    const summary = await calculateDailySummary(currentDate);
    summaries.push(summary);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return summaries;
}
