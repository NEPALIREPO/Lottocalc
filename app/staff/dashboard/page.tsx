import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getBoxes } from '@/lib/actions/boxes';
import { getDailyBoxEntries } from '@/lib/actions/daily-entries';
import { getActivatedBooksForDate } from '@/lib/actions/activated-books';
import StaffDashboardClient from './client';

export default async function StaffDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const today = new Date().toISOString().split('T')[0];
  const boxes = await getBoxes();
  const entries = await getDailyBoxEntries(today);
  const activatedBooksForToday = await getActivatedBooksForDate(today);

  return (
    <StaffDashboardClient
      boxes={boxes}
      entries={entries}
      activatedBooksForDate={activatedBooksForToday}
    />
  );
}
