import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminDashboardClient from './client';
import { calculateDailySummary } from '@/lib/calculations';
import { getMismatchCountToday } from '@/lib/actions/continuity';
import { getPlayerBalances } from '@/lib/actions/players';
import { getLotteryReports } from '@/lib/actions/lottery-reports';
import { getPOSReport } from '@/lib/actions/pos-reports';
import { getBoxes } from '@/lib/actions/boxes';
import { getDailyBoxEntries } from '@/lib/actions/daily-entries';
import { getActivatedBooksForDate } from '@/lib/actions/activated-books';
import { getPlayers, getPlayerDailyActivities } from '@/lib/actions/players';

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch role from public.users table
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = userData?.role;
  if (role !== 'ADMIN') {
    redirect('/staff/dashboard');
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Reports data
  const summary = await calculateDailySummary(today);
  const mismatchCount = await getMismatchCountToday();
  const playerBalances = await getPlayerBalances();
  const playerDailyActivities = await getPlayerDailyActivities(todayStr);
  const lotteryReports = await getLotteryReports(todayStr);
  const posReport = await getPOSReport(todayStr);
  
  // Entry data
  const boxes = await getBoxes();
  const entries = await getDailyBoxEntries(todayStr);
  const activatedBooksForToday = await getActivatedBooksForDate(todayStr);
  const players = await getPlayers();

  // Calculate lottery due (sum of net_due from reports)
  const lotteryDue = lotteryReports?.reduce((sum, r) => sum + (r.net_due || 0), 0) || 0;
  
  // Calculate outstanding player credit (negative balances)
  const outstandingCredit = playerBalances
    .filter((p) => p.balance < 0)
    .reduce((sum, p) => sum + Math.abs(p.balance), 0);

  return (
    <AdminDashboardClient
      summary={summary}
      mismatchCount={mismatchCount}
      lotteryDue={lotteryDue}
      outstandingCredit={outstandingCredit}
      playerBalances={playerBalances}
      playerDailyActivities={playerDailyActivities}
      boxes={boxes}
      entries={entries}
      activatedBooksForDate={activatedBooksForToday}
      players={players}
    />
  );
}
