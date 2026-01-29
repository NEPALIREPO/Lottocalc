'use server';

import { createClient } from '@/lib/supabase/server';
import { toSupabaseError } from '@/lib/supabase/errors';
import { revalidatePath } from 'next/cache';

export async function getBoxes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('boxes')
    .select('*')
    .order('box_number', { ascending: true, nullsFirst: false })
    .order('name');

  if (error) throw toSupabaseError(error);
  return data;
}

export async function createBox(
  name: string, 
  ticketValue: number, 
  category: string,
  boxNumber?: number | null
) {
  const supabase = await createClient();
  const insertData: any = { 
    name, 
    ticket_value: ticketValue, 
    category 
  };
  
  // Only include box_number if explicitly provided (null means auto-assign)
  if (boxNumber !== undefined && boxNumber !== null) {
    insertData.box_number = boxNumber;
  }
  
  const { data, error } = await supabase
    .from('boxes')
    .insert(insertData)
    .select()
    .single();

  if (error) throw toSupabaseError(error);
  revalidatePath('/admin/dashboard');
  revalidatePath('/staff/dashboard');
  return data;
}

export async function updateBox(
  boxId: string,
  name: string,
  ticketValue: number,
  category: string,
  boxNumber?: number | null
) {
  const supabase = await createClient();
  const updateData: any = {
    name,
    ticket_value: ticketValue,
    category,
  };
  
  if (boxNumber !== undefined) {
    updateData.box_number = boxNumber;
  }
  
  const { data, error } = await supabase
    .from('boxes')
    .update(updateData)
    .eq('id', boxId)
    .select()
    .single();

  if (error) throw toSupabaseError(error);
  revalidatePath('/admin/dashboard');
  revalidatePath('/staff/dashboard');
  return data;
}

export async function deleteBox(boxId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('boxes')
    .delete()
    .eq('id', boxId);

  if (error) throw toSupabaseError(error);
  revalidatePath('/admin/dashboard');
  revalidatePath('/staff/dashboard');
}
