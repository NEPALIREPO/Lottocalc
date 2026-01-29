import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getBoxes } from '@/lib/actions/boxes';
import { getDailyBoxEntries } from '@/lib/actions/daily-entries';
import { getActivatedBooksForDate } from '@/lib/actions/activated-books';
import StaffDashboardClient from './client';

export default async function StaffDashboardPage() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('Auth error in StaffDashboardPage:', authError);
      redirect('/login');
    }

    if (!user) {
      redirect('/login');
    }

    const today = new Date().toISOString().split('T')[0];
    
    let boxes = [];
    let entries = [];
    let activatedBooksForToday = [];

    try {
      boxes = await getBoxes();
    } catch (error) {
      console.error('Error getting boxes in StaffDashboardPage:', error);
      boxes = [];
    }

    try {
      entries = await getDailyBoxEntries(today);
    } catch (error) {
      console.error('Error getting daily box entries in StaffDashboardPage:', error);
      entries = [];
    }

    try {
      activatedBooksForToday = await getActivatedBooksForDate(today);
    } catch (error) {
      console.error('Error getting activated books in StaffDashboardPage:', error);
      activatedBooksForToday = [];
    }

    return (
      <StaffDashboardClient
        boxes={boxes}
        entries={entries}
        activatedBooksForDate={activatedBooksForToday}
      />
    );
  } catch (error) {
    console.error('Error in StaffDashboardPage:', error);
    redirect('/login');
  }
}
