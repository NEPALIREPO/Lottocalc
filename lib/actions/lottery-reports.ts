'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getLotteryReports(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lottery_reports')
    .select('*')
    .eq('date', date)
    .order('created_at');

  if (error) throw error;
  return data;
}

export async function getAllLotteryReports(limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('lottery_reports')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/** Net Sales = Total Sales - Discount - Cancels - Free Bets */
function computeNetSales(totalSales: number, discount: number, cancels: number, freeBets: number): number {
  return totalSales - discount - cancels - freeBets;
}

/** Net Due = Net Sales - Commission - Cashes - Cash Bonus + Service Fee */
function computeNetDue(netSales: number, commission: number, cashes: number, cashBonus: number, serviceFee: number): number {
  return netSales - commission - cashes - cashBonus + serviceFee;
}

export async function createLotteryReport(
  date: string,
  reportType: 'instant_34' | 'special_50',
  data: {
    instantTicketCount?: number;
    instantTotal?: number;
    netSales?: number;
    commission?: number;
    netDue?: number;
    rawImageUrl?: string;
    // Special Report 50 fields
    eventCount?: number;
    eventValue?: number;
    totalSales?: number;
    seasonTkts?: number;
    discount?: number;
    cancels?: number;
    freeBets?: number;
    cashCount?: number;
    cashValue?: number;
    cashBonus?: number;
    claimsBonus?: number;
    adjustments?: number;
    serviceFee?: number;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  let netSales = data.netSales;
  let netDue = data.netDue;

  if (reportType === 'special_50') {
    const totalSales = Number(data.totalSales) || 0;
    const discount = Number(data.discount) || 0;
    const cancels = Number(data.cancels) || 0;
    const freeBets = Number(data.freeBets) || 0;
    const commission = Number(data.commission) || 0;
    const cashValue = Number(data.cashValue) || 0;
    const cashBonus = Number(data.cashBonus) || 0;
    const serviceFee = Number(data.serviceFee) || 0;
    if (netSales == null && (data.totalSales != null || data.discount != null || data.cancels != null || data.freeBets != null)) {
      netSales = computeNetSales(totalSales, discount, cancels, freeBets);
    }
    if (netDue == null && netSales != null) {
      netDue = computeNetDue(netSales, commission, cashValue, cashBonus, serviceFee);
    }
  }

  const { data: report, error } = await supabase
    .from('lottery_reports')
    .upsert(
      {
        date,
        report_type: reportType,
        instant_ticket_count: data.instantTicketCount,
        instant_total: data.instantTotal,
        net_sales: netSales,
        commission: data.commission,
        net_due: netDue,
        raw_image_url: data.rawImageUrl,
        event_count: data.eventCount,
        event_value: data.eventValue,
        total_sales: data.totalSales,
        season_tkts: data.seasonTkts,
        discount: data.discount,
        cancels: data.cancels,
        free_bets: data.freeBets,
        cash_count: data.cashCount,
        cash_value: data.cashValue,
        cash_bonus: data.cashBonus,
        claims_bonus: data.claimsBonus,
        adjustments: data.adjustments,
        service_fee: data.serviceFee,
        created_by: user.id,
      },
      { onConflict: 'date,report_type' }
    )
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/staff/dashboard');
  revalidatePath('/admin/dashboard');
  return report;
}
