'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getPOSReport(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pos_reports')
    .select('*')
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getAllPOSReports(limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pos_reports')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function createPOSReport(
  date: string,
  data: {
    groceryTotal: number;
    cash: number;
    card: number;
    rawImageUrl?: string;
  }
) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: report, error } = await supabase
    .from('pos_reports')
    .upsert(
      {
        date,
        grocery_total: data.groceryTotal,
        cash: data.cash,
        card: data.card,
        raw_image_url: data.rawImageUrl,
        created_by: user.id,
      },
      { onConflict: 'date' }
    )
    .select()
    .single();

  if (error) throw error;
  revalidatePath('/staff/dashboard');
  revalidatePath('/admin/dashboard');
  return report;
}
