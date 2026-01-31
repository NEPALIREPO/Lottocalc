'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/** 23502 = not_null_violation. When entering "-" we send null for open/close; DB must allow it (migration 030). */
function wrapDailyEntryError(error: unknown): never {
  const e = error as { code?: string; message?: string };
  if (e?.code === '23502') {
    throw new Error(
      'Entering "-" for Open or Close is not allowed yet. Run database migrations so open/close can be null: npx supabase migration up (or db push).'
    );
  }
  throw error;
}

export async function getDailyBoxEntries(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('daily_box_entries')
    .select(`
      id,
      date,
      box_id,
      open_number,
      close_number,
      new_box_start_number,
      activated_book_id,
      sold_count,
      sold_amount,
      created_by,
      created_at,
      updated_at,
      boxes (*),
      activated_books (id, start_ticket_number, activated_date, ticket_count, note)
    `)
    .eq('date', date)
    .order('created_at');

  if (error) throw error;
  return data;
}

export async function saveAllDailyBoxEntries(
  date: string,
  entries: Array<{ 
    boxId: string; 
    openNumber: number | null; 
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
        open_number: openNumber ?? null,
        close_number: closeNumber ?? null,
        new_box_start_number: newBoxStartNumber ?? null,
        activated_book_id: activatedBookId ?? null,
        created_by: user.id,
      }, {
        onConflict: 'date,box_id'
      })
      .select(`*, boxes (*), activated_books (id, start_ticket_number, activated_date, ticket_count, note)`)
      .single();
    if (error) wrapDailyEntryError(error);
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

/** Save only open numbers (e.g. when store opens). Preserves existing close_number. */
export async function saveOpenNumbers(
  date: string,
  entries: Array<{
    boxId: string;
    openNumber: number | null;
    newBoxStartNumber?: number | null;
    activatedBookId?: string | null;
  }>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: existing } = await supabase
    .from('daily_box_entries')
    .select('box_id, close_number')
    .eq('date', date);

  const existingByBox = Object.fromEntries(
    (existing ?? []).map((r) => [r.box_id, r.close_number])
  );

  const results = [];
  for (const { boxId, openNumber, newBoxStartNumber, activatedBookId } of entries) {
    const { data, error } = await supabase
      .from('daily_box_entries')
      .upsert(
        {
          date,
          box_id: boxId,
          open_number: openNumber ?? null,
          close_number: existingByBox[boxId] ?? null,
          new_box_start_number: newBoxStartNumber ?? null,
          activated_book_id: activatedBookId ?? null,
          created_by: user.id,
        },
        { onConflict: 'date,box_id' }
      )
      .select(`*, boxes (*), activated_books (id, start_ticket_number, activated_date, ticket_count, note)`)
      .single();
    if (error) wrapDailyEntryError(error);
    results.push(data);
    existingByBox[boxId] = data?.close_number ?? null;
  }

  revalidatePath('/staff/dashboard');
  revalidatePath('/admin/dashboard');
  return results;
}

/** Save only close numbers (e.g. when store closes). Preserves existing open_number. */
export async function saveCloseNumbers(
  date: string,
  entries: Array<{ boxId: string; closeNumber: number | null }>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: existing } = await supabase
    .from('daily_box_entries')
    .select('box_id, open_number, new_box_start_number, activated_book_id')
    .eq('date', date);

  const existingByBox = Object.fromEntries(
    (existing ?? []).map((r) => [
      r.box_id,
      {
        open_number: r.open_number,
        new_box_start_number: r.new_box_start_number,
        activated_book_id: r.activated_book_id,
      },
    ])
  );

  const results = [];
  for (const { boxId, closeNumber } of entries) {
    const prev = existingByBox[boxId];
    const { data, error } = await supabase
      .from('daily_box_entries')
      .upsert(
        {
          date,
          box_id: boxId,
          open_number: prev?.open_number ?? null,
          close_number: closeNumber ?? null,
          new_box_start_number: prev?.new_box_start_number ?? null,
          activated_book_id: prev?.activated_book_id ?? null,
          created_by: user.id,
        },
        { onConflict: 'date,box_id' }
      )
      .select(`*, boxes (*), activated_books (id, start_ticket_number, activated_date, ticket_count, note)`)
      .single();
    if (error) wrapDailyEntryError(error);
    results.push(data);
  }

  revalidatePath('/staff/dashboard');
  revalidatePath('/admin/dashboard');
  return results;
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
