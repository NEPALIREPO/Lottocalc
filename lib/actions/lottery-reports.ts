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

  const { data: report, error } = await supabase
    .from('lottery_reports')
    .upsert(
      {
        date,
        report_type: reportType,
        instant_ticket_count: data.instantTicketCount,
        instant_total: data.instantTotal,
        net_sales: data.netSales,
        commission: data.commission,
        net_due: data.netDue,
        raw_image_url: data.rawImageUrl,
        // Special Report 50 fields
        event_count: data.eventCount,
        event_value: data.eventValue,
        total_sales: data.totalSales, // Total sales (tickets sold online - income)
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
