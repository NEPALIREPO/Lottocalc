'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getDailyBoxEntries(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('daily_box_entries')
    .select(`
      *,
      boxes (*),
      activated_books (id, start_ticket_number, activated_date, ticket_count, note)
    `)
    .eq('date', date)
    .order('created_at');

  if (error) throw error;
  return data;
}

export async function upsertDailyBoxEntry(
  date: string,
  boxId: string,
  openNumber: number,
  closeNumber: number
) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('daily_box_entries')
    .upsert({
      date,
      box_id: boxId,
      open_number: openNumber,
      close_number: closeNumber,
      created_by: user.id,
    }, {
      onConflict: 'date,box_id'
    })
    .select(`
      *,
      boxes (*)
    `)
    .single();

  if (error) throw error;
  revalidatePath('/staff/dashboard');
  revalidatePath('/admin/dashboard');
  return data;
}

export async function saveAllDailyBoxEntries(
  date: string,
  entries: Array<{ 
    boxId: string; 
    openNumber: number; 
    closeNumber: number | null;
    newBoxStartNumber?: number | null;
    activatedBookId?: string | null;
  }>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const results = [];
  for (const { boxId, openNumber, closeNumber, newBoxStartNumber, activatedBookId } of entries) {
    const { data, error } = await supabase
      .from('daily_box_entries')
      .upsert({
        date,
        box_id: boxId,
        open_number: openNumber,
        close_number: closeNumber ?? null,
        new_box_start_number: newBoxStartNumber ?? null,
        activated_book_id: activatedBookId ?? null,
        created_by: user.id,
      }, {
        onConflict: 'date,box_id'
      })
      .select(`*, boxes (*), activated_books (id, start_ticket_number, activated_date, ticket_count, note)`)
      .single();
    if (error) throw error;
    results.push(data);
  }

  revalidatePath('/staff/dashboard');
  revalidatePath('/admin/dashboard');
  return results;
}

export async function getDailyEntrySubmission(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('daily_entry_submissions')
    .select('date, submitted_at, submitted_by')
    .eq('date', date)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function markDailyEntriesSubmitted(date: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('daily_entry_submissions')
    .upsert(
      { date, submitted_at: new Date().toISOString(), submitted_by: user.id },
      { onConflict: 'date' }
    );

  if (error) throw error;
  revalidatePath('/staff/dashboard');
  revalidatePath('/admin/dashboard');
}
