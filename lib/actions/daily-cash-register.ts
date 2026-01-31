'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface DailyCashRegisterRow {
  date: string;
  lottery_cash_at_register: number | null;
  grocery_cash_at_register: number | null;
  updated_at: string | null;
}

export async function getDailyCashRegister(date: string): Promise<DailyCashRegisterRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('daily_cash_register')
    .select('date, lottery_cash_at_register, grocery_cash_at_register, updated_at')
    .eq('date', date)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertDailyCashRegister(
  date: string,
  values: { lotteryCashAtRegister?: number | null; groceryCashAtRegister?: number | null }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('daily_cash_register')
    .upsert(
      {
        date,
        lottery_cash_at_register: values.lotteryCashAtRegister ?? null,
        grocery_cash_at_register: values.groceryCashAtRegister ?? null,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'date' }
    );

  if (error) throw error;
  revalidatePath('/admin/dashboard');
  revalidatePath('/staff/dashboard');
  return getDailyCashRegister(date);
}
