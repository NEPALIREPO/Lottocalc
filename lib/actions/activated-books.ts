'use server';

import { createClient } from '@/lib/supabase/server';
import { toSupabaseError } from '@/lib/supabase/errors';
import { revalidatePath } from 'next/cache';

export async function getActivatedBooks(opts?: { boxId?: string; fromDate?: string; limit?: number }) {
  const supabase = await createClient();
  let query = supabase
    .from('activated_books')
    .select(`
      *,
      boxes (box_number, name, ticket_value)
    `)
    .order('activated_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.boxId) query = query.eq('box_id', opts.boxId);
  if (opts?.fromDate) query = query.gte('activated_date', opts.fromDate);

  const { data, error } = await query;
  if (error) throw toSupabaseError(error);
  return data ?? [];
}

/** Activated books for a specific date (one per box). Used to link to daily box entries. */
export async function getActivatedBooksForDate(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('activated_books')
    .select('id, box_id, start_ticket_number, activated_date, ticket_count, note')
    .eq('activated_date', date)
    .order('created_at', { ascending: false });

  if (error) throw toSupabaseError(error);
  return data ?? [];
}

export async function createActivatedBook(
  boxId: string,
  activatedDate: string,
  startTicketNumber: number,
  ticketCount: number,
  note?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('activated_books')
    .insert({
      box_id: boxId,
      activated_date: activatedDate,
      start_ticket_number: startTicketNumber,
      ticket_count: ticketCount,
      note: note ?? null,
      created_by: user.id,
    })
    .select(`
      *,
      boxes (box_number, name, ticket_value)
    `)
    .single();

  if (error) throw toSupabaseError(error);
  revalidatePath('/staff/dashboard');
  revalidatePath('/admin/dashboard');
  return data;
}
