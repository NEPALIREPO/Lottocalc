'use server';

import { createClient } from '@/lib/supabase/server';
import { getDailyCashRegister } from './daily-cash-register';

export interface DailyReportGeneratedFields {
  date: string;
  /** 1. Scratch Sales Report – total sales from daily box entry */
  scratchSales: number;
  /** 2. Online ticket sales – net sales from Special Report 50 only */
  onlineTicketSales: number;
  /** 3. Total lottery sales = 1 + 2 */
  totalLotterySales: number;
  /** 4. Total lottery cashing – cashes from Report 34 (instant_total) + Report 50 (cash_value) */
  totalLotteryCashing: number;
  /** 5. Total Lottery Due = 3 - 4 */
  totalLotteryDue: number;
  /** 6. Total Daily Udhari – net of players for the day (play - payment - win) */
  totalDailyUdhari: number;
  /** 7. Lottery cash in Hand = 5 - 6 */
  lotteryCashInHand: number;
  /** 8. Lottery cash at register – from data entry */
  lotteryCashAtRegister: number | null;
  /** 9. Total grocery cash at register – from data entry or POS */
  totalGroceryCashAtRegister: number;
  /** 10. Total cash in hand daily for pickup = 7 + 9 */
  totalCashInHandDailyForPickup: number;
}

export async function getDailyReportGeneratedFields(dateStr: string): Promise<DailyReportGeneratedFields> {
  const supabase = await createClient();

  const [
    { data: boxEntries },
    { data: lotteryReports },
    { data: playerTransactions },
    { data: posReports },
    cashRegister,
  ] = await Promise.all([
    supabase.from('daily_box_entries').select('sold_amount').eq('date', dateStr),
    supabase.from('lottery_reports').select('report_type, net_sales, instant_total, cash_value').eq('date', dateStr),
    supabase.from('player_transactions').select('transaction_type, amount').eq('date', dateStr),
    supabase.from('pos_reports').select('grocery_total').eq('date', dateStr).limit(1),
    getDailyCashRegister(dateStr),
  ]);

  // 1. Scratch Sales
  const scratchSales = boxEntries?.reduce((sum, r) => sum + (Number(r.sold_amount) || 0), 0) ?? 0;

  // 2. Online ticket sales (Special Report 50 net_sales only)
  const onlineTicketSales =
    lotteryReports
      ?.filter((r) => r.report_type === 'special_50')
      .reduce((sum, r) => sum + (Number(r.net_sales) || 0), 0) ?? 0;

  // 3. Total lottery sales
  const totalLotterySales = scratchSales + onlineTicketSales;

  // 4. Total lottery cashing (Report 34 instant_total + Report 50 cash_value)
  const totalLotteryCashing =
    (lotteryReports?.reduce((sum, r) => {
      if (r.report_type === 'instant_34') return sum + (Number(r.instant_total) || 0);
      if (r.report_type === 'special_50') return sum + (Number(r.cash_value) || 0);
      return sum;
    }, 0) ?? 0);

  // 5. Total Lottery Due
  const totalLotteryDue = totalLotterySales - totalLotteryCashing;

  // 6. Total Daily Udhari (net of players for the day)
  let totalDailyUdhari = 0;
  playerTransactions?.forEach((t) => {
    const amt = Number(t.amount) || 0;
    const type = t.transaction_type ?? 'play';
    if (type === 'play') totalDailyUdhari += amt;
    else if (type === 'payment' || type === 'win') totalDailyUdhari -= amt;
  });

  // 7. Lottery cash in Hand
  const lotteryCashInHand = totalLotteryDue - totalDailyUdhari;

  // 8. Lottery cash at register (data entry)
  const lotteryCashAtRegister = cashRegister?.lottery_cash_at_register ?? null;

  // 9. Total grocery cash at register (data entry, or fallback to POS)
  const totalGroceryCashAtRegister =
    cashRegister?.grocery_cash_at_register ?? posReports?.[0]?.grocery_total ?? 0;

  // 10. Total cash in hand daily for pickup
  const totalCashInHandDailyForPickup = lotteryCashInHand + totalGroceryCashAtRegister;

  return {
    date: dateStr,
    scratchSales,
    onlineTicketSales,
    totalLotterySales,
    totalLotteryCashing,
    totalLotteryDue,
    totalDailyUdhari,
    lotteryCashInHand,
    lotteryCashAtRegister,
    totalGroceryCashAtRegister,
    totalCashInHandDailyForPickup,
  };
}
