'use server';

import { createClient } from '@/lib/supabase/server';

export async function getContinuityLogs(date?: string) {
  const supabase = await createClient();
  let query = supabase
    .from('ticket_continuity_logs')
    .select(`
      *,
      boxes (*)
    `)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);

  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getMismatchCountToday(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const logs = await getContinuityLogs(today);
  return logs.length;
}
