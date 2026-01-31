import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getBoxes } from '@/lib/actions/boxes';
import { getDailyBoxEntries } from '@/lib/actions/daily-entries';
import { getActivatedBooksForDate } from '@/lib/actions/activated-books';
import type { Entry } from '@/lib/types/dashboard';
import StaffDashboardClient from './client';

type BoxesResult = Awaited<ReturnType<typeof getBoxes>>;
type EntriesResult = Awaited<ReturnType<typeof getDailyBoxEntries>>;
type ActivatedBooksResult = Awaited<ReturnType<typeof getActivatedBooksForDate>>;

export const dynamic = 'force-dynamic';

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

    let boxes: BoxesResult = [];
    let entries: EntriesResult = [];
    let activatedBooksForToday: ActivatedBooksResult = [];

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

    // Ensure props are serializable for Server Component → Client (no Date/undefined)
    const serialized = {
      boxes: JSON.parse(JSON.stringify(boxes ?? [])),
      entries: JSON.parse(JSON.stringify(entries ?? [])) as Entry[],
      activatedBooksForDate: JSON.parse(JSON.stringify(activatedBooksForToday ?? [])),
    };

    return (
      <StaffDashboardClient
        boxes={serialized.boxes}
        entries={serialized.entries}
        activatedBooksForDate={serialized.activatedBooksForDate}
      />
    );
  } catch (error) {
    console.error('Error in StaffDashboardPage:', error);
    redirect('/login');
  }
}
