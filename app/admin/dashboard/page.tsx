import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminDashboardClient from './client';
import type { Entry } from '@/lib/types/dashboard';
import { calculateDailySummary } from '@/lib/calculations';
import { getMismatchCountToday } from '@/lib/actions/continuity';
import { getPlayerBalances } from '@/lib/actions/players';
import { getLotteryReports } from '@/lib/actions/lottery-reports';
import { getBoxes } from '@/lib/actions/boxes';
import { getDailyBoxEntries } from '@/lib/actions/daily-entries';
import { getActivatedBooksForDate } from '@/lib/actions/activated-books';
import { getPlayers, getPlayerDailyActivities } from '@/lib/actions/players';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('Auth error:', authError);
      redirect('/login');
    }

    if (!user) {
      redirect('/login');
    }

    // Fetch role from public.users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('User role fetch error:', userError);
      // If user not found in users table, redirect to login
      redirect('/login');
    }

    const role = userData?.role;
    if (role !== 'ADMIN') {
      redirect('/staff/dashboard');
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Reports data - wrap each in try-catch to identify failing query
    let summary: Awaited<ReturnType<typeof calculateDailySummary>>;
    let mismatchCount: number = 0;
    let playerBalances: Array<{ playerId: string; name: string; balance: number }> = [];
    let playerDailyActivities: Awaited<ReturnType<typeof getPlayerDailyActivities>> = [];
    let lotteryReports: Awaited<ReturnType<typeof getLotteryReports>> = [];
    let boxes: Awaited<ReturnType<typeof getBoxes>>;
    let entries: Awaited<ReturnType<typeof getDailyBoxEntries>> = [];
    let activatedBooksForToday: Awaited<ReturnType<typeof getActivatedBooksForDate>> = [];
    let players: Awaited<ReturnType<typeof getPlayers>> = [];

    try {
      summary = await calculateDailySummary(today);
    } catch (error) {
      console.error('Error calculating daily summary:', error);
      // calculateDailySummary already returns default values on error, but if it throws, use defaults
      const dateStr = today.toISOString().split('T')[0];
      summary = {
        date: dateStr,
        scratchSales: 0,
        onlineSales: 0,
        grocerySales: 0,
        lotteryCashes: 0,
        playerBalance: 0,
        expectedCash: 0,
      };
    }

    try {
      mismatchCount = await getMismatchCountToday();
    } catch (error) {
      console.error('Error getting mismatch count:', error);
      mismatchCount = 0;
    }

    try {
      playerBalances = await getPlayerBalances();
    } catch (error) {
      console.error('Error getting player balances:', error);
      playerBalances = [];
    }

    try {
      playerDailyActivities = await getPlayerDailyActivities(todayStr);
    } catch (error) {
      console.error('Error getting player daily activities:', error);
      playerDailyActivities = [];
    }

    try {
      lotteryReports = await getLotteryReports(todayStr);
    } catch (error) {
      console.error('Error getting lottery reports:', error);
      lotteryReports = [];
    }

    // Entry data
    try {
      boxes = await getBoxes();
    } catch (error) {
      console.error('Error getting boxes:', error);
      // Return empty array instead of throwing to prevent complete page failure
      boxes = [];
    }

    try {
      entries = await getDailyBoxEntries(todayStr);
    } catch (error) {
      console.error('Error getting daily box entries:', error);
      entries = [];
    }

    try {
      activatedBooksForToday = await getActivatedBooksForDate(todayStr);
    } catch (error) {
      console.error('Error getting activated books:', error);
      activatedBooksForToday = [];
    }

    try {
      players = await getPlayers();
    } catch (error) {
      console.error('Error getting players:', error);
      players = [];
    }

    // Calculate lottery due (sum of net_due from reports)
    const lotteryDue = lotteryReports?.reduce((sum, r) => sum + (r.net_due || 0), 0) || 0;
    
    // Calculate outstanding player credit (negative balances)
    const outstandingCredit = playerBalances
      .filter((p) => p.balance < 0)
      .reduce((sum, p) => sum + Math.abs(p.balance), 0);

    // Ensure props are serializable for Server Component → Client (no Date/undefined)
    const serialized = {
      summary,
      mismatchCount,
      lotteryDue,
      outstandingCredit,
      playerBalances,
      playerDailyActivities,
      boxes: JSON.parse(JSON.stringify(boxes ?? [])) as typeof boxes,
      entries: JSON.parse(JSON.stringify(entries ?? [])) as Entry[],
      activatedBooksForDate: JSON.parse(JSON.stringify(activatedBooksForToday ?? [])),
      players: JSON.parse(JSON.stringify(players ?? [])),
    };

    return (
      <AdminDashboardClient
        summary={serialized.summary}
        mismatchCount={serialized.mismatchCount}
        lotteryDue={serialized.lotteryDue}
        outstandingCredit={serialized.outstandingCredit}
        playerBalances={serialized.playerBalances}
        playerDailyActivities={serialized.playerDailyActivities}
        boxes={serialized.boxes}
        entries={serialized.entries}
        activatedBooksForDate={serialized.activatedBooksForDate}
        players={serialized.players}
      />
    );
  } catch (error) {
    console.error('AdminDashboardPage error:', error);
    redirect('/login');
  }
}
