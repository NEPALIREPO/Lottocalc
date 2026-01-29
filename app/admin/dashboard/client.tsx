'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getContinuityLogs } from '@/lib/actions/continuity';
import { getWeeklySummary, getDateRangeSummary } from '@/lib/actions/calculations';
import { getBoxes, createBox, updateBox, deleteBox } from '@/lib/actions/boxes';
import { getDailyBoxEntries, saveAllDailyBoxEntries, getDailyEntrySubmission } from '@/lib/actions/daily-entries';
import { getActivatedBooks, getActivatedBooksForDate, createActivatedBook } from '@/lib/actions/activated-books';
import { createLotteryReport, getAllLotteryReports } from '@/lib/actions/lottery-reports';
import { createPOSReport, getAllPOSReports } from '@/lib/actions/pos-reports';
import { getPlayers, createPlayer, createPlayerTransaction, getPlayerBalance, getPlayerTransactions, type PlayerDailyActivity } from '@/lib/actions/players';
import { uploadFileClient } from '@/lib/actions/storage';
import { processLotteryReportImage, processPOSReportImage } from '@/lib/ocr';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Ticket, LogOut, FileText, BarChart3 } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DailySummary {
  date: string;
  scratchSales: number;
  onlineSales: number;
  grocerySales: number;
  lotteryCashes: number;
  playerBalance: number;
  expectedCash: number;
}

interface ContinuityLog {
  id: string;
  date: string;
  box_id: string;
  prev_close: number;
  today_open: number;
  difference: number;
  severity: string;
  boxes: {
    name: string;
  };
}

interface PlayerBalance {
  playerId: string;
  name: string;
  balance: number;
}

interface Box {
  id: string;
  box_number: number | null;
  name: string;
  ticket_value: number;
  category: string;
}

interface Entry {
  id: string;
  date: string;
  box_id: string;
  open_number: number;
  close_number: number | null;
  new_box_start_number: number | null;
  activated_book_id: string | null;
  sold_count: number;
  sold_amount: number;
  boxes: Box;
  activated_books?: { id: string; start_ticket_number: number; activated_date: string; ticket_count: number; note: string | null } | null;
}

interface ActivatedBookForDate {
  id: string;
  box_id: string;
  start_ticket_number: number;
  activated_date: string;
  ticket_count: number;
  note: string | null;
}

interface Player {
  id: string;
  name: string;
}

const PREDEFINED_TICKET_VALUES = [1, 2, 5, 10, 20, 25, 30, 50];

export default function AdminDashboardClient({
  summary: initialSummary,
  mismatchCount,
  lotteryDue,
  outstandingCredit,
  playerBalances: initialPlayerBalances,
  playerDailyActivities = [],
  boxes: initialBoxes,
  entries: initialEntries,
  activatedBooksForDate = [],
  players: initialPlayers = [],
}: {
  summary: DailySummary;
  mismatchCount: number;
  lotteryDue: number;
  outstandingCredit: number;
  playerBalances: PlayerBalance[];
  playerDailyActivities?: PlayerDailyActivity[];
  boxes: Box[];
  entries: Entry[];
  activatedBooksForDate?: ActivatedBookForDate[];
  players?: Player[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];
  const [userInfo, setUserInfo] = useState<{ email: string; name?: string } | null>(null);
  
  // Reports state
  const [continuityLogs, setContinuityLogs] = useState<ContinuityLog[]>([]);
  const [weeklyData, setWeeklyData] = useState<DailySummary[]>([]);
  const [dateRangeFrom, setDateRangeFrom] = useState(today);
  const [dateRangeTo, setDateRangeTo] = useState(today);
  const [rangeSummary, setRangeSummary] = useState<DailySummary | null>(null);
  const [loadingRange, setLoadingRange] = useState(false);
  
  // Entry state
  const [entryDate, setEntryDate] = useState(today);
  const [entrySubmission, setEntrySubmission] = useState<{ date: string; submitted_at: string } | null>(null);
  const [boxes, setBoxes] = useState<Box[]>(initialBoxes);
  const [entries, setEntries] = useState<Record<string, Entry>>(
    Object.fromEntries(initialEntries.map((e) => [e.box_id, e]))
  );
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [activatedBooksList, setActivatedBooksList] = useState<any[]>([]);
  const [activatedBooksForToday, setActivatedBooksForToday] = useState<ActivatedBookForDate[]>(activatedBooksForDate);
  const [loadingEntryDate, setLoadingEntryDate] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'entry' | 'reports'>('entry');
  const [entryTab, setEntryTab] = useState<'boxes' | 'activatedBooks' | 'reports' | 'players'>('boxes');
  const [reportsTab, setReportsTab] = useState<'overview' | 'mismatches' | 'players' | 'weekly' | 'boxManagement' | 'receipts'>('overview');
  const [lotteryReportsList, setLotteryReportsList] = useState<any[]>([]);
  const [posReportsList, setPosReportsList] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingBox, setEditingBox] = useState<Box | null>(null);
  const [boxForm, setBoxForm] = useState({
    name: '',
    ticketValue: '',
    category: 'regular' as 'regular' | 'high' | 'seasonal',
    boxNumber: '',
    useCustomValue: false,
  });

  useEffect(() => {
    loadContinuityLogs();
    loadWeeklyData();
    loadPlayers();
    loadActivatedBooks();
    loadReceipts();
    // Load user info
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserInfo({ email: user.email || '', name: user.user_metadata?.name || 'Admin' });
      }
    });
  }, []);

  const loadEntriesForDate = async (date: string) => {
    setLoadingEntryDate(true);
    try {
      const [entriesData, activatedData, submission] = await Promise.all([
        getDailyBoxEntries(date),
        getActivatedBooksForDate(date),
        getDailyEntrySubmission(date),
      ]);
      setEntries(Object.fromEntries(entriesData.map((e) => [e.box_id, e])));
      setActivatedBooksForToday(activatedData || []);
      setEntrySubmission(submission);
    } catch (e) {
      console.error('Failed to load entries for date:', e);
    } finally {
      setLoadingEntryDate(false);
    }
  };

  useEffect(() => {
    if (entryDate) loadEntriesForDate(entryDate);
  }, [entryDate]);

  const loadReceipts = async () => {
    try {
      const [lotteryReports, posReports] = await Promise.all([
        getAllLotteryReports(50),
        getAllPOSReports(50),
      ]);
      setLotteryReportsList(lotteryReports || []);
      setPosReportsList(posReports || []);
    } catch (error) {
      console.error('Failed to load receipts:', error);
    }
  };

  const loadContinuityLogs = async () => {
    try {
      const logs = await getContinuityLogs();
      setContinuityLogs(logs);
    } catch (error) {
      console.error('Failed to load continuity logs:', error);
    }
  };

  const loadWeeklyData = async () => {
    try {
      const todayDate = new Date();
      const startOfWeek = new Date(todayDate);
      startOfWeek.setDate(todayDate.getDate() - 6); // Last 7 days
      const data = await getWeeklySummary(startOfWeek);
      setWeeklyData(data);
    } catch (error) {
      console.error('Failed to load weekly data:', error);
    }
  };

  const loadDateRangeSummary = async () => {
    if (!dateRangeFrom || !dateRangeTo) return;
    
    setLoadingRange(true);
    try {
      const fromDate = new Date(dateRangeFrom);
      const toDate = new Date(dateRangeTo);
      
      if (fromDate > toDate) {
        alert('From date must be before or equal to To date');
        setLoadingRange(false);
        return;
      }
      
      const summary = await getDateRangeSummary(fromDate, toDate);
      setRangeSummary(summary);
    } catch (error) {
      console.error('Failed to load date range summary:', error);
      alert('Failed to calculate expected cash for date range');
    } finally {
      setLoadingRange(false);
    }
  };

  const loadPlayers = async () => {
    try {
      const data = await getPlayers();
      setPlayers(data);
    } catch (error) {
      console.error('Failed to load players:', error);
    }
  };

  const loadActivatedBooks = async () => {
    try {
      const data = await getActivatedBooks({ limit: 50 });
      setActivatedBooksList(data);
    } catch (error) {
      console.error('Failed to load activated books:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const loadBoxes = async () => {
    try {
      const updatedBoxes = await getBoxes();
      setBoxes(updatedBoxes);
    } catch (error) {
      console.error('Failed to load boxes:', error);
      alert('Failed to load boxes');
    }
  };

  const handleCreateBox = async () => {
    if (!boxForm.name.trim()) {
      alert('Please enter a box name');
      return;
    }
    const ticketValue = parseFloat(boxForm.ticketValue);
    if (isNaN(ticketValue) || ticketValue <= 0) {
      alert('Please enter a valid ticket value');
      return;
    }
    setLoading(true);
    try {
      await createBox(
        boxForm.name,
        ticketValue,
        boxForm.category,
        boxForm.boxNumber ? parseInt(boxForm.boxNumber, 10) : undefined
      );
      await loadBoxes();
      setBoxForm({
        name: '',
        ticketValue: '',
        category: 'regular',
        boxNumber: '',
        useCustomValue: false,
      });
    } catch (error: any) {
      alert(error.message || 'Failed to create box');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBox = async () => {
    if (!editingBox) return;
    if (!boxForm.name.trim()) {
      alert('Please enter a box name');
      return;
    }
    const ticketValue = parseFloat(boxForm.ticketValue);
    if (isNaN(ticketValue) || ticketValue <= 0) {
      alert('Please enter a valid ticket value');
      return;
    }
    setLoading(true);
    try {
      await updateBox(
        editingBox.id,
        boxForm.name,
        ticketValue,
        boxForm.category,
        boxForm.boxNumber ? parseInt(boxForm.boxNumber, 10) : null
      );
      await loadBoxes();
      setEditingBox(null);
      setBoxForm({
        name: '',
        ticketValue: '',
        category: 'regular',
        boxNumber: '',
        useCustomValue: false,
      });
    } catch (error: any) {
      alert(error.message || 'Failed to update box');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBox = async (boxId: string) => {
    if (!confirm('Are you sure you want to delete this box? This action cannot be undone.')) {
      return;
    }
    setLoading(true);
    try {
      await deleteBox(boxId);
      await loadBoxes();
    } catch (error: any) {
      alert(error.message || 'Failed to delete box');
    } finally {
      setLoading(false);
    }
  };

  const startEditBox = (box: Box) => {
    setEditingBox(box);
    setBoxForm({
      name: box.name,
      ticketValue: box.ticket_value.toString(),
      category: box.category as 'regular' | 'high' | 'seasonal',
      boxNumber: box.box_number?.toString() || '',
      useCustomValue: !PREDEFINED_TICKET_VALUES.includes(box.ticket_value),
    });
  };

  const cancelEdit = () => {
    setEditingBox(null);
    setBoxForm({
      name: '',
      ticketValue: '',
      category: 'regular',
      boxNumber: '',
      useCustomValue: false,
    });
  };

  // Entry handlers (admin can always edit; Sold/Amount calculated after submit via refetch)
  const handleSaveAllBoxEntries = async (
    updates: Array<{ 
      boxId: string; 
      openNumber: number; 
      closeNumber: number | null;
      newBoxStartNumber?: number | null;
      activatedBookId?: string | null;
    }>
  ) => {
    if (updates.length === 0) {
      alert('Enter at least one open and close number.');
      return;
    }
    setLoading(true);
    try {
      await saveAllDailyBoxEntries(entryDate, updates);
      const newEntries = await getDailyBoxEntries(entryDate);
      setEntries(Object.fromEntries(newEntries.map((e) => [e.box_id, e])));
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLotteryReport = async (
    reportType: 'instant_34' | 'special_50',
    file: File,
    ocrData: any
  ) => {
    setLoading(true);
    try {
      const imageUrl = await uploadFileClient(supabase, file, `lottery/${reportType}`);
      
      if (reportType === 'instant_34') {
        await createLotteryReport(today, reportType, {
          instantTicketCount: ocrData.ticketCount,
          instantTotal: ocrData.totalSales,
          netDue: ocrData.netDue,
          rawImageUrl: imageUrl,
        });
      } else {
        // Special Report 50
        await createLotteryReport(today, reportType, {
          eventCount: ocrData.eventCount,
          eventValue: ocrData.eventValue,
          totalSales: ocrData.totalSalesOnline, // Total sales (tickets sold online)
          netSales: ocrData.netSales, // Net sales (total sales - discounts - cancels - free bets)
          commission: ocrData.commission,
          cashCount: ocrData.cashCount,
          cashValue: ocrData.cashValue,
          cashBonus: ocrData.cashBonus,
          claimsBonus: ocrData.claimsBonus,
          adjustments: ocrData.adjustments,
          serviceFee: ocrData.serviceFee,
          netDue: ocrData.netDue,
          rawImageUrl: imageUrl,
        });
      }
      await loadReceipts(); // Refresh receipts list
      alert('Lottery report saved successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to save lottery report');
    } finally {
      setLoading(false);
    }
  };

  const handlePOSReport = async (file: File, ocrData: any) => {
    setLoading(true);
    try {
      const imageUrl = await uploadFileClient(supabase, file, 'pos');
      
      await createPOSReport(today, {
        groceryTotal: ocrData.totalSales || 0,
        cash: ocrData.cash || 0,
        card: ocrData.card || 0,
        rawImageUrl: imageUrl,
      });
      await loadReceipts(); // Refresh receipts list
      alert('POS report saved successfully');
    } catch (error: any) {
      alert(error.message || 'Failed to save POS report');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlayer = async (name: string) => {
    try {
      await createPlayer(name);
      await loadPlayers();
    } catch (error: any) {
      alert(error.message || 'Failed to add player');
    }
  };

  const handleCreateActivatedBook = async (
    boxId: string,
    activatedDate: string,
    startTicketNumber: number,
    ticketCount: number,
    note?: string
  ) => {
    setLoading(true);
    try {
      const created = await createActivatedBook(boxId, activatedDate, startTicketNumber, ticketCount, note);
      await loadActivatedBooks();
      if (activatedDate === today && created) {
        const forDate = await getActivatedBooksForDate(today);
        setActivatedBooksForToday(forDate);
      }
    } catch (error: any) {
      alert(error?.message ?? 'Failed to add activated book');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerTransaction = async (
    playerId: string,
    transactionType: 'play' | 'payment' | 'win',
    amount: number,
    note: string,
    gameDetails?: string
  ) => {
    try {
      await createPlayerTransaction(playerId, transactionType, amount, today, { note, gameDetails });
      alert('Transaction recorded');
    } catch (error: any) {
      alert(error.message || 'Failed to record transaction');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50';
      case 'error':
        return 'text-orange-600 bg-orange-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Ticket className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">LottoLedger</h1>
                <p className="text-xs text-gray-600">Admin Dashboard</p>
              </div>
            </div>

            {/* User Info and Logout */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{userInfo?.name || 'Admin'}</p>
                <p className="text-xs text-gray-600">{userInfo?.email || ''}</p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeSection} onValueChange={(v: string) => {
          setActiveSection(v as 'entry' | 'reports');
          if (v === 'reports') {
            loadContinuityLogs();
            loadWeeklyData();
          }
        }} className="space-y-6">
          {/* Main Tab Navigation */}
          <TabsList className="bg-white border border-gray-200 p-1">
            <TabsTrigger value="entry" className="gap-2">
              <FileText className="w-4 h-4" />
              Entry
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          {/* Entry Section */}
          <TabsContent value="entry" className="space-y-6">
            <Tabs value={entryTab} onValueChange={(v: string) => {
              setEntryTab(v as 'boxes' | 'activatedBooks' | 'reports' | 'players');
              if (v === 'activatedBooks') loadActivatedBooks();
            }} className="space-y-6">
              <TabsList className="bg-white border border-gray-200 p-1">
                <TabsTrigger value="boxes">Box Entries</TabsTrigger>
                <TabsTrigger value="activatedBooks">Activated Books</TabsTrigger>
                <TabsTrigger value="reports">Reports Upload</TabsTrigger>
                <TabsTrigger value="players">Players</TabsTrigger>
              </TabsList>

              <TabsContent value="boxes">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <Label htmlFor="entry-date">Entry date</Label>
                    <Input
                      id="entry-date"
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      disabled={loadingEntryDate}
                      className="w-40"
                    />
                    {entrySubmission && (
                      <span className="text-sm text-muted-foreground">
                        Submitted {formatDate(entrySubmission.submitted_at)} — only admin can edit
                      </span>
                    )}
                  </div>
                  <DailyBoxEntrySheet
                    boxes={boxes}
                    entries={entries}
                    today={entryDate}
                    activatedBooksForDate={activatedBooksForToday}
                    onSaveAll={handleSaveAllBoxEntries}
                    loading={loading}
                    isAdmin={true}
                    isSubmitted={!!entrySubmission}
                  />
                </div>
              </TabsContent>

              <TabsContent value="activatedBooks">
                <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>New activated book</CardTitle>
                <CardDescription>
                  When a new ticket book/roll is printed, add an entry. Tickets are 0-based (e.g. 50 tickets = 0 to 49).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActivatedBookForm
                  boxes={boxes}
                  today={entryDate}
                  onCreate={handleCreateActivatedBook}
                  loading={loading}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Activated book detail</CardTitle>
                <CardDescription>Recent activated books (new ticket rolls).</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Box</TableHead>
                      <TableHead>Start #</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>End #</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activatedBooksList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground text-center py-8">
                          No activated books yet. Add one above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      activatedBooksList.map((row: any) => {
                        const box = row.boxes;
                        const endNum = row.start_ticket_number + row.ticket_count - 1;
                        return (
                          <TableRow key={row.id}>
                            <TableCell>{row.activated_date}</TableCell>
                            <TableCell>
                              {box ? (box.box_number != null ? `Box ${box.box_number} — ${box.name}` : box.name) : '—'}
                            </TableCell>
                            <TableCell className="tabular-nums">{row.start_ticket_number}</TableCell>
                            <TableCell className="tabular-nums">{row.ticket_count}</TableCell>
                            <TableCell className="tabular-nums text-muted-foreground">{endNum}</TableCell>
                            <TableCell className="text-muted-foreground">{row.note ?? '—'}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
                </div>
              </TabsContent>

              <TabsContent value="reports">
                <div className="space-y-4">
                  <Card>
              <CardHeader>
                <CardTitle>Lottery Reports</CardTitle>
                <CardDescription>
                  Scan or upload receipt images. Values will be automatically extracted and saved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReportUpload
                  title="Instant Report 34"
                  reportType="instant_34"
                  onUpload={(file, ocrData) => handleLotteryReport('instant_34', file, ocrData)}
                  disabled={loading}
                />
                <ReportUpload
                  title="Special Report 50"
                  onUpload={(file, ocrData) => handleLotteryReport('special_50', file, ocrData)}
                  disabled={loading}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>POS Terminal Receipt</CardTitle>
                <CardDescription>
                  Scan or upload POS receipt. Values will be automatically extracted and saved.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <POSReportUpload
                  onUpload={handlePOSReport}
                  disabled={loading}
                />
              </CardContent>
            </Card>
                </div>
              </TabsContent>

              <TabsContent value="players">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Player Credit Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <PlayerCreditForm
                        players={players}
                        onAddPlayer={handleAddPlayer}
                        onTransaction={handlePlayerTransaction}
                        onLoadBalance={getPlayerBalance}
                        onLoadTransactions={getPlayerTransactions}
                        disabled={loading}
                      />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Reports Section */}
          <TabsContent value="reports" className="space-y-6">
            <Tabs value={reportsTab} onValueChange={(v: string) => {
              setReportsTab(v as 'overview' | 'mismatches' | 'players' | 'weekly' | 'boxManagement' | 'receipts');
              if (v === 'mismatches') loadContinuityLogs();
              if (v === 'weekly') loadWeeklyData();
              if (v === 'boxManagement') loadBoxes();
              if (v === 'receipts') loadReceipts();
            }} className="space-y-6">
              <TabsList className="bg-white border border-gray-200 p-1">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="mismatches">Mismatches</TabsTrigger>
                <TabsTrigger value="players">Players</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="boxManagement">Box Management</TabsTrigger>
                <TabsTrigger value="receipts">Receipts</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="space-y-6">
                  <Card>
              <CardHeader>
                <CardTitle>Expected Cash by Date Range</CardTitle>
                <CardDescription>Select a date range to calculate expected cash</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="dateFrom">From Date</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={dateRangeFrom}
                      onChange={(e) => setDateRangeFrom(e.target.value)}
                      max={today}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="dateTo">To Date</Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={dateRangeTo}
                      onChange={(e) => setDateRangeTo(e.target.value)}
                      max={today}
                    />
                  </div>
                  <Button onClick={loadDateRangeSummary} disabled={loadingRange || !dateRangeFrom || !dateRangeTo}>
                    {loadingRange ? 'Calculating...' : 'Calculate'}
                  </Button>
                </div>
                {rangeSummary && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
                    <div className="text-sm text-muted-foreground mb-2">
                      Expected Cash for {formatDate(dateRangeFrom)} to {formatDate(dateRangeTo)}
                    </div>
                    <div className="text-3xl font-bold">{formatCurrency(rangeSummary.expectedCash)}</div>
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Scratch Sales</div>
                        <div className="font-semibold">{formatCurrency(rangeSummary.scratchSales)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Online Sales</div>
                        <div className="font-semibold">{formatCurrency(rangeSummary.onlineSales)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Grocery Sales</div>
                        <div className="font-semibold">{formatCurrency(rangeSummary.grocerySales)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Lottery Cashes</div>
                        <div className="font-semibold">{formatCurrency(rangeSummary.lotteryCashes)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Today Expected Cash</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(initialSummary.expectedCash)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lottery Due</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(lotteryDue)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Outstanding Credit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(outstandingCredit)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Boxes Mismatched</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{mismatchCount}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Daily Sales Breakdown</CardTitle>
                <CardDescription>{formatDate(initialSummary.date)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Scratch Sales</div>
                    <div className="text-2xl font-bold">{formatCurrency(initialSummary.scratchSales)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Online Sales</div>
                    <div className="text-2xl font-bold">{formatCurrency(initialSummary.onlineSales)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Grocery Sales</div>
                    <div className="text-2xl font-bold">{formatCurrency(initialSummary.grocerySales)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Lottery Cashes</div>
                    <div className="text-2xl font-bold">{formatCurrency(initialSummary.lotteryCashes)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Player Balance</div>
                    <div className="text-2xl font-bold">{formatCurrency(initialSummary.playerBalance)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
                </div>
              </TabsContent>

              <TabsContent value="mismatches">
                <Card>
                  <CardHeader>
                    <CardTitle>Ticket Continuity Logs</CardTitle>
                    <CardDescription>Mismatches between closing and opening ticket numbers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Box</TableHead>
                          <TableHead>Previous Close</TableHead>
                          <TableHead>Today Open</TableHead>
                          <TableHead>Difference</TableHead>
                          <TableHead>Severity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {continuityLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No mismatches found
                            </TableCell>
                          </TableRow>
                        ) : (
                          continuityLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>{formatDate(log.date)}</TableCell>
                              <TableCell>{log.boxes.name}</TableCell>
                              <TableCell>{log.prev_close}</TableCell>
                              <TableCell>{log.today_open}</TableCell>
                              <TableCell>{log.difference}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(log.severity)}`}>
                                  {log.severity}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="players">
                <Card>
                  <CardHeader>
                    <CardTitle>Player Balances</CardTitle>
                    <CardDescription>Daily activities and current credit balances for all players</CardDescription>
                  </CardHeader>
                  <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player Name</TableHead>
                    <TableHead className="text-right">Played Balance</TableHead>
                    <TableHead className="text-right">Win Balance</TableHead>
                    <TableHead className="text-right">Paid Balance</TableHead>
                    <TableHead className="text-right font-semibold">Total Balance Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playerDailyActivities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No players found
                      </TableCell>
                    </TableRow>
                  ) : (
                    playerDailyActivities.map((activity) => (
                      <TableRow key={activity.playerId}>
                        <TableCell className="font-medium">{activity.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {activity.playedBalance > 0 ? (
                            <span className="text-orange-600">+{formatCurrency(activity.playedBalance)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {activity.winBalance > 0 ? (
                            <span className="text-green-600">-{formatCurrency(activity.winBalance)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {activity.paidBalance > 0 ? (
                            <span className="text-blue-600">-{formatCurrency(activity.paidBalance)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums font-semibold ${activity.totalBalanceDue < 0 ? 'text-red-600' : activity.totalBalanceDue > 0 ? 'text-orange-600' : ''}`}>
                          {formatCurrency(activity.totalBalanceDue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {playerDailyActivities.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Total Played Today</div>
                      <div className="text-lg font-semibold text-orange-600">
                        {formatCurrency(playerDailyActivities.reduce((sum, a) => sum + a.playedBalance, 0))}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total Wins Today</div>
                      <div className="text-lg font-semibold text-green-600">
                        {formatCurrency(playerDailyActivities.reduce((sum, a) => sum + a.winBalance, 0))}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total Paid Today</div>
                      <div className="text-lg font-semibold text-blue-600">
                        {formatCurrency(playerDailyActivities.reduce((sum, a) => sum + a.paidBalance, 0))}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total Outstanding</div>
                      <div className="text-lg font-semibold text-red-600">
                        {formatCurrency(playerDailyActivities.reduce((sum, a) => sum + Math.max(0, a.totalBalanceDue), 0))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="weekly">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Weekly Cash Flow</CardTitle>
                      <CardDescription>Expected cash over the last 7 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => formatDate(value)}
                    />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => formatDate(label)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="expectedCash"
                      stroke="#8884d8"
                      name="Expected Cash"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Weekly Sales Breakdown</CardTitle>
                      <CardDescription>Sales by category over the last 7 days</CardDescription>
                    </CardHeader>
                    <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => formatDate(value)}
                    />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => formatDate(label)}
                    />
                    <Legend />
                    <Bar dataKey="scratchSales" fill="#8884d8" name="Scratch Sales" />
                    <Bar dataKey="onlineSales" fill="#82ca9d" name="Online Sales" />
                    <Bar dataKey="grocerySales" fill="#ffc658" name="Grocery Sales" />
                  </BarChart>
                </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Weekly Summary Table</CardTitle>
                    </CardHeader>
                    <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Scratch</TableHead>
                      <TableHead>Online</TableHead>
                      <TableHead>Grocery</TableHead>
                      <TableHead>Expected Cash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyData.map((day) => (
                      <TableRow key={day.date}>
                        <TableCell>{formatDate(day.date)}</TableCell>
                        <TableCell>{formatCurrency(day.scratchSales)}</TableCell>
                        <TableCell>{formatCurrency(day.onlineSales)}</TableCell>
                        <TableCell>{formatCurrency(day.grocerySales)}</TableCell>
                        <TableCell className="font-bold">{formatCurrency(day.expectedCash)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="boxManagement">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>{editingBox ? 'Edit Box' : 'Create New Box'}</CardTitle>
                      <CardDescription>
                        {editingBox ? 'Update box details' : 'Add a new box to the system'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Box Name</Label>
                          <Input
                            value={boxForm.name}
                            onChange={(e) => setBoxForm({ ...boxForm, name: e.target.value })}
                            placeholder="Box no 1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Box Number (1-80, optional - auto-assigned if empty)</Label>
                          <Input
                            type="number"
                            min="1"
                            max="80"
                            value={boxForm.boxNumber}
                            onChange={(e) => setBoxForm({ ...boxForm, boxNumber: e.target.value })}
                            placeholder="Auto-assign"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Ticket Value</Label>
                          <div className="flex gap-2">
                            <select
                              value={boxForm.useCustomValue ? 'custom' : boxForm.ticketValue}
                              onChange={(e) => {
                                if (e.target.value === 'custom') {
                                  setBoxForm({ ...boxForm, useCustomValue: true, ticketValue: '' });
                                } else {
                                  setBoxForm({ ...boxForm, useCustomValue: false, ticketValue: e.target.value });
                                }
                              }}
                              className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2"
                            >
                              <option value="">Select value...</option>
                              {PREDEFINED_TICKET_VALUES.map((val) => (
                                <option key={val} value={val}>
                                  ${val}
                                </option>
                              ))}
                              <option value="custom">Custom value...</option>
                            </select>
                            {boxForm.useCustomValue && (
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={boxForm.ticketValue}
                                onChange={(e) => setBoxForm({ ...boxForm, ticketValue: e.target.value })}
                                placeholder="0.00"
                                className="w-32"
                              />
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <select
                            value={boxForm.category}
                            onChange={(e) => setBoxForm({ ...boxForm, category: e.target.value as any })}
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                          >
                            <option value="regular">Regular</option>
                            <option value="high">High</option>
                            <option value="seasonal">Seasonal</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        {editingBox ? (
                          <>
                            <Button onClick={handleUpdateBox} disabled={loading}>
                              Update Box
                            </Button>
                            <Button onClick={cancelEdit} variant="outline" disabled={loading}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button onClick={handleCreateBox} disabled={loading}>
                            Create Box
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>All Boxes</CardTitle>
                      <CardDescription>Manage existing boxes (sorted by box number)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Box #</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Ticket Value</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {boxes.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                  No boxes found
                                </TableCell>
                              </TableRow>
                            ) : (
                              boxes.map((box) => (
                                <TableRow key={box.id}>
                                  <TableCell className="font-medium">
                                    {box.box_number ?? '—'}
                                  </TableCell>
                                  <TableCell>{box.name}</TableCell>
                                  <TableCell>{formatCurrency(box.ticket_value)}</TableCell>
                                  <TableCell>
                                    <span className="capitalize">{box.category}</span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        onClick={() => startEditBox(box)}
                                        variant="outline"
                                        size="sm"
                                        disabled={loading}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        onClick={() => handleDeleteBox(box.id)}
                                        variant="outline"
                                        size="sm"
                                        disabled={loading}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="receipts">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Uploaded Receipts</CardTitle>
                      <CardDescription>View all uploaded lottery and POS receipts</CardDescription>
                    </CardHeader>
                    <CardContent>
                <div className="space-y-6">
                  {/* Lottery Reports */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Lottery Reports</h3>
                    {lotteryReportsList.length === 0 ? (
                      <p className="text-muted-foreground">No lottery reports uploaded yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {lotteryReportsList.map((report) => (
                          <Card key={report.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                            <CardContent className="p-0">
                              {report.raw_image_url ? (
                                <div 
                                  className="relative bg-muted cursor-pointer group border-b"
                                  onClick={() => setSelectedImage(report.raw_image_url)}
                                >
                                  <div className="aspect-[3/4] flex items-center justify-center overflow-hidden">
                                    <img
                                      src={report.raw_image_url}
                                      alt={`${report.report_type} - ${report.date}`}
                                      className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200"
                                    />
                                  </div>
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium bg-black/70 px-3 py-1 rounded">
                                      Click to enlarge
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                                  <span className="text-muted-foreground text-sm">No image</span>
                                </div>
                              )}
                              <div className="p-4 space-y-3">
                                <div>
                                  <div className="font-semibold capitalize text-sm">
                                    {report.report_type === 'instant_34' ? 'Instant Report 34' : 'Special Report 50'}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">{formatDate(report.date)}</div>
                                </div>
                                <div className="space-y-1.5 text-xs">
                                  {report.report_type === 'instant_34' ? (
                                    <>
                                      {report.instant_ticket_count != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Tickets cashed out:</span>
                                          <span className="font-medium">{report.instant_ticket_count}</span>
                                        </div>
                                      )}
                                      {report.instant_total != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Total amount cashed out:</span>
                                          <span className="font-medium">{formatCurrency(report.instant_total)}</span>
                                        </div>
                                      )}
                                      {report.net_due != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Net Due:</span>
                                          <span className="font-medium">{formatCurrency(report.net_due)}</span>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      {report.event_count != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Event Count:</span>
                                          <span className="font-medium">{report.event_count}</span>
                                        </div>
                                      )}
                                      {report.event_value != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Event Value:</span>
                                          <span className="font-medium">{formatCurrency(report.event_value)}</span>
                                        </div>
                                      )}
                                      {report.total_sales != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Total Sales (Online):</span>
                                          <span className="font-medium">{formatCurrency(report.total_sales)}</span>
                                        </div>
                                      )}
                                      {report.net_sales != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Net Sales:</span>
                                          <span className="font-medium">{formatCurrency(report.net_sales)}</span>
                                        </div>
                                      )}
                                      {report.commission != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Commission:</span>
                                          <span className="font-medium">{formatCurrency(report.commission)}</span>
                                        </div>
                                      )}
                                      {report.cash_count != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Cash Count:</span>
                                          <span className="font-medium">{report.cash_count}</span>
                                        </div>
                                      )}
                                      {report.cash_value != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Cash Value:</span>
                                          <span className="font-medium">{formatCurrency(report.cash_value)}</span>
                                        </div>
                                      )}
                                      {report.cash_bonus != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Cash Bonus:</span>
                                          <span className="font-medium">{formatCurrency(report.cash_bonus)}</span>
                                        </div>
                                      )}
                                      {report.claims_bonus != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Claims Bonus:</span>
                                          <span className="font-medium">{formatCurrency(report.claims_bonus)}</span>
                                        </div>
                                      )}
                                      {report.adjustments != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Adjustments:</span>
                                          <span className="font-medium">{formatCurrency(report.adjustments)}</span>
                                        </div>
                                      )}
                                      {report.service_fee != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Service Fee:</span>
                                          <span className="font-medium">{formatCurrency(report.service_fee)}</span>
                                        </div>
                                      )}
                                      {report.net_due != null && (
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Net Due:</span>
                                          <span className="font-medium">{formatCurrency(report.net_due)}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* POS Reports */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">POS Terminal Receipts</h3>
                    {posReportsList.length === 0 ? (
                      <p className="text-muted-foreground">No POS receipts uploaded yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {posReportsList.map((report) => (
                          <Card key={report.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                            <CardContent className="p-0">
                              {report.raw_image_url ? (
                                <div 
                                  className="relative bg-muted cursor-pointer group border-b"
                                  onClick={() => setSelectedImage(report.raw_image_url)}
                                >
                                  <div className="aspect-[3/4] flex items-center justify-center overflow-hidden">
                                    <img
                                      src={report.raw_image_url}
                                      alt={`POS Receipt - ${report.date}`}
                                      className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200"
                                    />
                                  </div>
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium bg-black/70 px-3 py-1 rounded">
                                      Click to enlarge
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                                  <span className="text-muted-foreground text-sm">No image</span>
                                </div>
                              )}
                              <div className="p-4 space-y-3">
                                <div>
                                  <div className="font-semibold text-sm">POS Terminal Receipt</div>
                                  <div className="text-xs text-muted-foreground mt-1">{formatDate(report.date)}</div>
                                </div>
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Grocery Total:</span>
                                    <span className="font-medium">{formatCurrency(report.grocery_total)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Cash:</span>
                                    <span className="font-medium">{formatCurrency(report.cash)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Card:</span>
                                    <span className="font-medium">{formatCurrency(report.card)}</span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                    </div>
                  </CardContent>
                </Card>
                </div>
              </TabsContent>

              <TabsContent value="boxManagement">
                <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{editingBox ? 'Edit Box' : 'Create New Box'}</CardTitle>
                <CardDescription>
                  {editingBox ? 'Update box details' : 'Add a new box to the system'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Box Name</Label>
                    <Input
                      value={boxForm.name}
                      onChange={(e) => setBoxForm({ ...boxForm, name: e.target.value })}
                      placeholder="Box no 1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Box Number (1-80, optional - auto-assigned if empty)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="80"
                      value={boxForm.boxNumber}
                      onChange={(e) => setBoxForm({ ...boxForm, boxNumber: e.target.value })}
                      placeholder="Auto-assign"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ticket Value</Label>
                    <div className="flex gap-2">
                      <select
                        value={boxForm.useCustomValue ? 'custom' : boxForm.ticketValue}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setBoxForm({ ...boxForm, useCustomValue: true, ticketValue: '' });
                          } else {
                            setBoxForm({ ...boxForm, useCustomValue: false, ticketValue: e.target.value });
                          }
                        }}
                        className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2"
                      >
                        <option value="">Select value...</option>
                        {PREDEFINED_TICKET_VALUES.map((val) => (
                          <option key={val} value={val}>
                            ${val}
                          </option>
                        ))}
                        <option value="custom">Custom value...</option>
                      </select>
                      {boxForm.useCustomValue && (
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={boxForm.ticketValue}
                          onChange={(e) => setBoxForm({ ...boxForm, ticketValue: e.target.value })}
                          placeholder="0.00"
                          className="w-32"
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <select
                      value={boxForm.category}
                      onChange={(e) => setBoxForm({ ...boxForm, category: e.target.value as any })}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                    >
                      <option value="regular">Regular</option>
                      <option value="high">High</option>
                      <option value="seasonal">Seasonal</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  {editingBox ? (
                    <>
                      <Button onClick={handleUpdateBox} disabled={loading}>
                        Update Box
                      </Button>
                      <Button onClick={cancelEdit} variant="outline" disabled={loading}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={handleCreateBox} disabled={loading}>
                      Create Box
                    </Button>
                  )}
                </div>
              </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>All Boxes</CardTitle>
                      <CardDescription>Manage existing boxes (sorted by box number)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Box #</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Ticket Value</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {boxes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No boxes found
                          </TableCell>
                        </TableRow>
                      ) : (
                        boxes.map((box) => (
                          <TableRow key={box.id}>
                            <TableCell className="font-medium">
                              {box.box_number ?? '—'}
                            </TableCell>
                            <TableCell>{box.name}</TableCell>
                            <TableCell>{formatCurrency(box.ticket_value)}</TableCell>
                            <TableCell>
                              <span className="capitalize">{box.category}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  onClick={() => startEditBox(box)}
                                  variant="outline"
                                  size="sm"
                                  disabled={loading}
                                >
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => handleDeleteBox(box.id)}
                                  variant="outline"
                                  size="sm"
                                  disabled={loading}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Image Modal */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] w-full">
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black/50 rounded-full p-2"
              >
                ✕
              </button>
              <img
                src={selectedImage}
                alt="Receipt"
                className="w-full h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Entry Components (shared with staff dashboard)

function DailyBoxEntrySheet({
  boxes,
  entries,
  today,
  activatedBooksForDate = [],
  onSaveAll,
  loading,
  isAdmin = true,
  isSubmitted = false,
}: {
  boxes: Box[];
  entries: Record<string, Entry>;
  today: string;
  activatedBooksForDate?: ActivatedBookForDate[];
  onSaveAll: (updates: Array<{ 
    boxId: string; 
    openNumber: number; 
    closeNumber: number | null;
    newBoxStartNumber?: number | null;
    activatedBookId?: string | null;
  }>) => void;
  loading: boolean;
  isAdmin?: boolean;
  isSubmitted?: boolean;
}) {
  const readOnly = isSubmitted && !isAdmin;
  // Sort boxes by box_number (1-80), ensuring sequential order
  const sortedBoxes = [...boxes].sort((a, b) => {
    const aNum = a.box_number ?? 999;
    const bNum = b.box_number ?? 999;
    return aNum - bNum;
  });

  // Map: box_id -> activated book (for today). One activated book per box per date.
  const activatedBooksByBox = Object.fromEntries(
    activatedBooksForDate.map((ab) => [ab.box_id, ab])
  );

  const [formValues, setFormValues] = useState<Record<string, { open: string; close: string; newBoxStart: string }>>(
    () =>
      Object.fromEntries(
        sortedBoxes.map((box) => {
          const entry = entries[box.id];
          const activatedBook = activatedBooksByBox[box.id];
          // Prefer entry value; else use activated book's start_ticket_number when linked
          const newBoxStart =
            entry?.new_box_start_number?.toString() ??
            (activatedBook ? String(activatedBook.start_ticket_number) : '');
          return [
            box.id,
            {
              open: entry?.open_number?.toString() ?? '',
              close: entry?.close_number?.toString() ?? '',
              newBoxStart,
            },
          ];
        })
      )
  );

  // Sync form from entries and activated books when they change
  useEffect(() => {
    setFormValues((prev) => {
      const next = { ...prev };
      let changed = false;
      sortedBoxes.forEach((box) => {
        const entry = entries[box.id];
        const activatedBook = activatedBooksByBox[box.id];
        const open = entry?.open_number?.toString() ?? '';
        const close = entry?.close_number?.toString() ?? '';
        const newBoxStart =
          entry?.new_box_start_number?.toString() ??
          (activatedBook ? String(activatedBook.start_ticket_number) : '');
        if (next[box.id]?.open !== open || next[box.id]?.close !== close || next[box.id]?.newBoxStart !== newBoxStart) {
          next[box.id] = { open, close, newBoxStart };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [entries, activatedBooksForDate]);

  const setBoxValue = (boxId: string, field: 'open' | 'close' | 'newBoxStart', value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [boxId]: { ...prev[boxId], [field]: value },
    }));
  };

  const handleSaveAll = () => {
    const updates: Array<{ 
      boxId: string; 
      openNumber: number; 
      closeNumber: number | null;
      newBoxStartNumber?: number | null;
      activatedBookId?: string | null;
    }> = [];
    sortedBoxes.forEach((box) => {
      const v = formValues[box.id];
      if (!v) return;
      const openNum = parseInt(v.open, 10);
      if (isNaN(openNum)) return;
      
      const closeNum = v.close.trim() ? parseInt(v.close, 10) : null;
      const newBoxStartNum = v.newBoxStart.trim() ? parseInt(v.newBoxStart, 10) : null;
      const activatedBook = activatedBooksByBox[box.id];
      // Link to activated book when value matches the book's start_ticket_number
      const activatedBookId =
        activatedBook && newBoxStartNum === activatedBook.start_ticket_number
          ? activatedBook.id
          : null;

      updates.push({ 
        boxId: box.id, 
        openNumber: openNum, 
        closeNumber: closeNum,
        newBoxStartNumber: newBoxStartNum,
        activatedBookId: activatedBookId ?? undefined,
      });
    });
    if (updates.length === 0) {
      alert('Enter at least one opening number.');
      return;
    }
    onSaveAll(updates);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Box Entry — {today}</CardTitle>
        <CardDescription>
          {readOnly
            ? 'This date has been submitted. Only admin can edit.'
            : 'Tickets are 0-based (e.g. 50 tickets = 0 to 49). Enter Open # (required) and Close # (optional). New box start # is pre-filled from activated books—add a book in the &quot;Activated books&quot; tab first. Sold and Amount are calculated after you press Save.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Box #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-24 text-muted-foreground font-normal text-xs">New box start #<br /><span className="text-[10px]">(from activated book)</span></TableHead>
                <TableHead className="w-28">Ticket</TableHead>
                <TableHead className="w-28">Open #</TableHead>
                <TableHead className="w-28">Close #</TableHead>
                <TableHead className="w-20 text-muted-foreground font-normal">Sold (calc.)</TableHead>
                <TableHead className="w-24 text-muted-foreground font-normal">Amount (calc.)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBoxes.map((box) => {
                const entry = entries[box.id];
                const v = formValues[box.id] ?? { open: '', close: '', newBoxStart: '' };
                const openNum = parseInt(v.open, 10);
                const closeNum = v.close.trim() ? parseInt(v.close, 10) : null;
                const newBoxStartNum = v.newBoxStart.trim() ? parseInt(v.newBoxStart, 10) : null;
                const hasOpen = !isNaN(openNum);
                // Use server-calculated values after save when available
                const soldFromServer = entry?.sold_count ?? null;
                const amountFromServer = entry?.sold_amount ?? null;
                let sold: number | null = soldFromServer;
                if (sold === null && hasOpen) {
                  if (newBoxStartNum !== null) {
                    sold = openNum - (closeNum ?? 0) + newBoxStartNum + 1 + (closeNum === null ? 1 : 0);
                  } else {
                    sold = openNum - (closeNum ?? 0) + (closeNum === null ? 1 : 0);
                  }
                }
                const amount = amountFromServer !== null ? amountFromServer : (sold !== null && box.ticket_value != null ? sold * box.ticket_value : null);
                return (
                  <TableRow key={box.id}>
                    <TableCell className="font-medium">
                      {box.box_number != null ? box.box_number : '—'}
                    </TableCell>
                    <TableCell>{box.name}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <Input
                          type="number"
                          placeholder="—"
                          className="w-20 h-9 text-xs text-muted-foreground"
                          value={v.newBoxStart}
                          onChange={(e) => setBoxValue(box.id, 'newBoxStart', e.target.value)}
                          title="New box start # (from activated book or manual)"
                          disabled={readOnly}
                        />
                        {activatedBooksByBox[box.id] && (
                          <span className="text-[10px] text-muted-foreground" title="Activated book for this date">
                            from book
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCurrency(box.ticket_value)}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="Open"
                        className="w-24 h-9"
                        value={v.open}
                        onChange={(e) => setBoxValue(box.id, 'open', e.target.value)}
                        disabled={readOnly}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="Close (optional)"
                        className="w-24 h-9"
                        value={v.close}
                        onChange={(e) => setBoxValue(box.id, 'close', e.target.value)}
                        disabled={readOnly}
                      />
                    </TableCell>
                    <TableCell
                      className="min-w-[4rem] tabular-nums font-semibold text-foreground bg-muted/50 px-3 py-2 rounded select-none border border-border/50"
                      title="Calculated after Save"
                    >
                      {sold !== null ? sold : '—'}
                    </TableCell>
                    <TableCell
                      className="min-w-[5rem] tabular-nums font-semibold text-foreground bg-muted/50 px-3 py-2 rounded select-none border border-border/50"
                      title="Calculated after Save: Sold × Ticket value"
                    >
                      {amount !== null ? formatCurrency(amount) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {!readOnly && (
          <div className="flex justify-end">
            <Button onClick={handleSaveAll} disabled={loading}>
              {loading ? 'Saving…' : 'Save all entries'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivatedBookForm({
  boxes,
  today,
  onCreate,
  loading,
}: {
  boxes: Box[];
  today: string;
  onCreate: (
    boxId: string,
    activatedDate: string,
    startTicketNumber: number,
    ticketCount: number,
    note?: string
  ) => void;
  loading: boolean;
}) {
  const sortedBoxes = [...boxes].sort((a, b) => (a.box_number ?? 999) - (b.box_number ?? 999));
  const [boxId, setBoxId] = useState('');
  const [activatedDate, setActivatedDate] = useState(today);
  const [startTicketNumber, setStartTicketNumber] = useState('0');
  const [ticketCount, setTicketCount] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    const start = parseInt(startTicketNumber, 10);
    const count = parseInt(ticketCount, 10);
    if (!boxId || isNaN(start) || isNaN(count) || count < 1) {
      alert('Select a box and enter a valid start number (e.g. 0) and ticket count.');
      return;
    }
    onCreate(boxId, activatedDate, start, count, note.trim() || undefined);
    setTicketCount('');
    setNote('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Box</Label>
          <select
            value={boxId}
            onChange={(e) => setBoxId(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="">— Select box —</option>
            {sortedBoxes.map((box) => (
              <option key={box.id} value={box.id}>
                {box.box_number != null ? `Box ${box.box_number}` : ''} {box.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Activated date</Label>
          <Input
            type="date"
            value={activatedDate}
            onChange={(e) => setActivatedDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Start ticket # (0-based, e.g. 0)</Label>
          <Input
            type="number"
            min={0}
            value={startTicketNumber}
            onChange={(e) => setStartTicketNumber(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Ticket count</Label>
          <Input
            type="number"
            min={1}
            placeholder="e.g. 50"
            value={ticketCount}
            onChange={(e) => setTicketCount(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Note (optional)</Label>
        <Input
          placeholder="e.g. New roll"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <Button onClick={handleSubmit} disabled={loading || !boxId || !ticketCount}>
        Add activated book
      </Button>
    </div>
  );
}

function ReportUpload({
  title,
  reportType,
  onUpload,
  disabled,
}: {
  title: string;
  reportType?: 'instant_34' | 'special_50';
  onUpload: (file: File, ocrData: any) => Promise<void>;
  disabled: boolean;
}) {
  const isReport34 = reportType === 'instant_34';
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [ocrData, setOcrData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setProcessing(true);
    setError(null);
    setOcrData(null);

    try {
      const extracted = await processLotteryReportImage(selectedFile, reportType);
      setOcrData(extracted);
      // Check if we have any extracted data
      const hasData = isReport34
        ? (extracted.ticketCount != null || extracted.totalSales != null || extracted.netDue != null)
        : (extracted.eventCount != null || extracted.totalSalesOnline != null || extracted.netSales != null || 
           extracted.commission != null || extracted.cashCount != null || extracted.cashValue != null ||
           extracted.netDue != null);
      if (hasData) {
        onUpload(selectedFile, extracted);
        setTimeout(() => {
          setFile(null);
          setOcrData(null);
          if (e.target) e.target.value = '';
        }, 1000);
      } else {
        setError('Could not extract values from image. Please try again or check image quality.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process image. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const countLabel = isReport34 ? 'Tickets cashed out' : 'Ticket Count';
  const totalLabel = isReport34 ? 'Total amount cashed out' : 'Total';

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <Label className="text-base font-semibold">{title}</Label>
      {isReport34 && (
        <p className="text-xs text-muted-foreground">Daily cash out to players from online. Extracts: no of tickets cashed out, total amount cashed out.</p>
      )}
      {!isReport34 && (
        <p className="text-xs text-muted-foreground">Extracts: event count/value, total sales (online tickets), net sales, commission, cash count/value, bonuses, adjustments, service fee, net due.</p>
      )}
      <div className="space-y-2">
        <Input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={disabled || processing}
          className="cursor-pointer"
        />
        {processing && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="animate-pulse">⏳</span> Processing image and extracting values...
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        {ocrData && !processing && (
          <div className="space-y-2 p-3 bg-muted/50 rounded border">
            <div className="text-sm font-medium text-muted-foreground">Extracted values:</div>
            {isReport34 ? (
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{countLabel}:</span>
                  <div className="font-semibold">{ocrData.ticketCount ?? '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{totalLabel}:</span>
                  <div className="font-semibold">
                    {ocrData.totalSales != null ? formatCurrency(ocrData.totalSales) : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Net Due:</span>
                  <div className="font-semibold">
                    {ocrData.netDue != null ? formatCurrency(ocrData.netDue) : '—'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs">
                {ocrData.eventCount != null && (
                  <div>
                    <span className="text-muted-foreground">Event Count:</span>
                    <div className="font-semibold">{ocrData.eventCount}</div>
                  </div>
                )}
                {ocrData.eventValue != null && (
                  <div>
                    <span className="text-muted-foreground">Event Value:</span>
                    <div className="font-semibold">{formatCurrency(ocrData.eventValue)}</div>
                  </div>
                )}
                {ocrData.totalSalesOnline != null && (
                  <div>
                    <span className="text-muted-foreground">Total Sales (Online):</span>
                    <div className="font-semibold">{formatCurrency(ocrData.totalSalesOnline)}</div>
                  </div>
                )}
                {ocrData.netSales != null && (
                  <div>
                    <span className="text-muted-foreground">Net Sales:</span>
                    <div className="font-semibold">{formatCurrency(ocrData.netSales)}</div>
                  </div>
                )}
                {ocrData.commission != null && (
                  <div>
                    <span className="text-muted-foreground">Commission:</span>
                    <div className="font-semibold">{formatCurrency(ocrData.commission)}</div>
                  </div>
                )}
                {ocrData.cashCount != null && (
                  <div>
                    <span className="text-muted-foreground">Cash Count:</span>
                    <div className="font-semibold">{ocrData.cashCount}</div>
                  </div>
                )}
                {ocrData.cashValue != null && (
                  <div>
                    <span className="text-muted-foreground">Cash Value:</span>
                    <div className="font-semibold">{formatCurrency(ocrData.cashValue)}</div>
                  </div>
                )}
                {ocrData.cashBonus != null && (
                  <div>
                    <span className="text-muted-foreground">Cash Bonus:</span>
                    <div className="font-semibold">{formatCurrency(ocrData.cashBonus)}</div>
                  </div>
                )}
                {ocrData.claimsBonus != null && (
                  <div>
                    <span className="text-muted-foreground">Claims Bonus:</span>
                    <div className="font-semibold">{formatCurrency(ocrData.claimsBonus)}</div>
                  </div>
                )}
                {ocrData.adjustments != null && (
                  <div>
                    <span className="text-muted-foreground">Adjustments:</span>
                    <div className="font-semibold">{formatCurrency(ocrData.adjustments)}</div>
                  </div>
                )}
                {ocrData.serviceFee != null && (
                  <div>
                    <span className="text-muted-foreground">Service Fee:</span>
                    <div className="font-semibold">{formatCurrency(ocrData.serviceFee)}</div>
                  </div>
                )}
                {ocrData.netDue != null && (
                  <div>
                    <span className="text-muted-foreground">Net Due:</span>
                    <div className="font-semibold">{formatCurrency(ocrData.netDue)}</div>
                  </div>
                )}
              </div>
            )}
            <div className="text-xs text-green-600 mt-2">✓ Saved successfully</div>
          </div>
        )}
      </div>
    </div>
  );
}

function POSReportUpload({
  onUpload,
  disabled,
}: {
  onUpload: (file: File, ocrData: any) => Promise<void>;
  disabled: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [ocrData, setOcrData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setProcessing(true);
    setError(null);
    setOcrData(null);

    try {
      const extracted = await processPOSReportImage(selectedFile);
      setOcrData(extracted);
      
      // Auto-save when OCR completes successfully
      if (extracted.totalSales || extracted.cash || extracted.card) {
        onUpload(selectedFile, extracted);
        // Reset after successful save
        setTimeout(() => {
          setFile(null);
          setOcrData(null);
          if (e.target) e.target.value = '';
        }, 1000);
      } else {
        setError('Could not extract values from image. Please try again or check image quality.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process image. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <Label className="text-base font-semibold">POS Terminal Receipt</Label>
      <div className="space-y-2">
        <Input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={disabled || processing}
          className="cursor-pointer"
        />
        {processing && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="animate-pulse">⏳</span> Processing image and extracting values...
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        {ocrData && !processing && (
          <div className="space-y-2 p-3 bg-muted/50 rounded border">
            <div className="text-sm font-medium text-muted-foreground">Extracted values:</div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Grocery Total:</span>
                <div className="font-semibold">
                  {ocrData.totalSales ? formatCurrency(ocrData.totalSales) : '—'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Cash:</span>
                <div className="font-semibold">
                  {ocrData.cash ? formatCurrency(ocrData.cash) : '—'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Card:</span>
                <div className="font-semibold">
                  {ocrData.card ? formatCurrency(ocrData.card) : '—'}
                </div>
              </div>
            </div>
            <div className="text-xs text-green-600 mt-2">✓ Saved successfully</div>
          </div>
        )}
      </div>
    </div>
  );
}

interface TransactionRow {
  id: string;
  transaction_type: string;
  amount: number;
  game_details: string | null;
  note: string | null;
  date: string;
  created_at: string;
}

function PlayerCreditForm({
  players,
  onAddPlayer,
  onTransaction,
  onLoadBalance,
  onLoadTransactions,
  disabled,
}: {
  players: Player[];
  onAddPlayer: (name: string) => void;
  onTransaction: (
    playerId: string,
    type: 'play' | 'payment' | 'win',
    amount: number,
    note: string,
    gameDetails?: string
  ) => void;
  onLoadBalance: (playerId: string) => Promise<number>;
  onLoadTransactions: (playerId: string) => Promise<TransactionRow[]>;
  disabled: boolean;
}) {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [transactionType, setTransactionType] = useState<'play' | 'payment' | 'win'>('play');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [gameDetails, setGameDetails] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  const loadPlayerData = async (playerId: string) => {
    if (!playerId) {
      setBalance(null);
      setTransactions([]);
      return;
    }
    try {
      const [bal, txns] = await Promise.all([
        onLoadBalance(playerId),
        onLoadTransactions(playerId),
      ]);
      setBalance(bal);
      setTransactions(txns);
    } catch {
      setBalance(null);
      setTransactions([]);
    }
  };

  const handlePlayerSelect = (playerId: string) => {
    setSelectedPlayer(playerId);
    loadPlayerData(playerId);
  };

  const handleAddPlayer = () => {
    if (newPlayerName.trim()) {
      onAddPlayer(newPlayerName.trim());
      setNewPlayerName('');
    }
  };

  const handleTransaction = () => {
    const amt = parseFloat(amount);
    if (!selectedPlayer || !amount || isNaN(amt) || amt <= 0) {
      alert('Please select a player and enter a positive amount.');
      return;
    }
    onTransaction(selectedPlayer, transactionType, amt, note, gameDetails.trim() || undefined);
    setAmount('');
    setNote('');
    setGameDetails('');
    loadPlayerData(selectedPlayer);
  };

  const typeShort = { play: 'Play', payment: 'Payment', win: 'Win' };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Input
          placeholder="New player name"
          value={newPlayerName}
          onChange={(e) => setNewPlayerName(e.target.value)}
        />
        <Button onClick={handleAddPlayer} disabled={disabled}>
          Add Player
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Select Player</Label>
        <select
          value={selectedPlayer}
          onChange={(e) => handlePlayerSelect(e.target.value)}
          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
        >
          <option value="">Select a player</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedPlayer && balance !== null && (
          <p className="text-sm font-medium">
            Current balance (owed): {formatCurrency(balance)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Transaction type</Label>
        <select
          value={transactionType}
          onChange={(e) => setTransactionType(e.target.value as 'play' | 'payment' | 'win')}
          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
        >
          <option value="play">Play — Games played (amount owed)</option>
          <option value="payment">Payment — Player paid</option>
          <option value="win">Win — Player won</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label>Amount ($)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      {transactionType === 'play' && (
        <div className="space-y-2">
          <Label>Game details (optional)</Label>
          <Input
            placeholder="e.g. 3x $2 scratch, 2x $5 online"
            value={gameDetails}
            onChange={(e) => setGameDetails(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Note (optional)</Label>
        <Input
          placeholder={
            transactionType === 'payment'
              ? 'e.g. Partial payment, Week 1'
              : transactionType === 'win'
                ? 'e.g. Scratch ticket win'
                : 'Any note'
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <Button onClick={handleTransaction} disabled={disabled || !selectedPlayer}>
        Record {typeShort[transactionType]}
      </Button>

      {selectedPlayer && transactions.length > 0 && (
        <div className="space-y-2 pt-4 border-t">
          <Label>Recent transactions</Label>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 10).map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-sm">{txn.date}</TableCell>
                    <TableCell className="capitalize">{txn.transaction_type}</TableCell>
                    <TableCell>
                      {txn.transaction_type === 'play' ? '+' : '-'}
                      {formatCurrency(txn.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {txn.game_details || txn.note || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
