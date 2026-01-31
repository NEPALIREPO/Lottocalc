'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getContinuityLogs } from '@/lib/actions/continuity';
import { getWeeklySummary, getDateRangeSummary } from '@/lib/actions/calculations';
import type { DailySummary } from '@/lib/calculations';
import { getBoxes, createBox, updateBox, deleteBox } from '@/lib/actions/boxes';
import { getDailyBoxEntries, saveAllDailyBoxEntries, saveOpenNumbers, saveCloseNumbers, getDailyEntrySubmission, markDailyEntriesSubmitted } from '@/lib/actions/daily-entries';
import { getActivatedBooks, getActivatedBooksForDate, createActivatedBook, updateActivatedBook, deleteActivatedBook } from '@/lib/actions/activated-books';
import { createLotteryReport, getLotteryReports, getAllLotteryReports } from '@/lib/actions/lottery-reports';
import { createPOSReport, getAllPOSReports } from '@/lib/actions/pos-reports';
import { getDailyReportGeneratedFields, type DailyReportGeneratedFields } from '@/lib/actions/daily-report';
import { upsertDailyCashRegister } from '@/lib/actions/daily-cash-register';
import { getPlayers, createPlayer, createPlayerTransaction, getPlayerBalance, getPlayerTransactions, type PlayerDailyActivity } from '@/lib/actions/players';
import { uploadFileClient } from '@/lib/actions/storage';
import { processLotteryReportImage, processPOSReportImage, parsePOSReport } from '@/lib/ocr';
import { parseCSVForPOS, parseExcelForPOS, isPOSSpreadsheetFile } from '@/lib/parse-pos-file';
import { extractTextFromPDF, isPDFFile } from '@/lib/parse-pdf';
import { formatCurrency, formatDate } from '@/lib/utils';
import { parseOpenClose, openDisplay, closeDisplay } from '@/lib/utils/entries';
import { mapLotteryReportsToForms } from '@/lib/utils/lottery-forms';
import type { Box, Entry, Player, ActivatedBookForDate } from '@/lib/types/dashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Ticket, LogOut, FileText, BarChart3, DollarSign, TrendingUp, AlertCircle, Box as BoxIcon } from 'lucide-react';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { KPICard } from '@/components/admin/KPICard';

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

const PREDEFINED_TICKET_VALUES = [1, 2, 5, 10, 20, 25, 30, 50];

function ReportFieldRow({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-b border-border/50">
      <td className="p-3 text-muted-foreground align-top w-2/5">{label}</td>
      <td className="p-3 font-semibold tabular-nums">{formatCurrency(value)}</td>
    </tr>
  );
}

function ReportFieldRowEditable({
  label,
  value,
  onSave,
  disabled,
}: {
  label: string;
  value: number | null;
  onSave: (value: number | null) => void;
  disabled: boolean;
}) {
  const [edit, setEdit] = useState<string>(value != null ? String(value) : '');
  useEffect(() => {
    setEdit(value != null ? String(value) : '');
  }, [value]);
  const num = edit.trim() === '' ? null : parseFloat(edit);
  const valid = edit.trim() === '' || !Number.isNaN(num);
  return (
    <tr className="border-b border-border/50">
      <td className="p-3 text-muted-foreground align-top w-2/5">{label}</td>
      <td className="p-3 flex flex-wrap items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          className="w-32 h-9"
          value={edit}
          onChange={(e) => setEdit(e.target.value)}
          placeholder="Enter amount"
          disabled={disabled}
        />
        <Button size="sm" onClick={() => onSave(valid ? num : null)} disabled={disabled || !valid}>
          {disabled ? 'Saving…' : 'Save'}
        </Button>
        {value != null && (
          <span className="text-muted-foreground text-xs">Current: {formatCurrency(value)}</span>
        )}
      </td>
    </tr>
  );
}

function ReportFieldRowEditableList({
  label,
  value,
  onSave,
  disabled,
}: {
  label: string;
  value: number | null;
  onSave: (value: number | null) => void;
  disabled: boolean;
}) {
  const [edit, setEdit] = useState<string>(value != null ? String(value) : '');
  useEffect(() => {
    setEdit(value != null ? String(value) : '');
  }, [value]);
  const num = edit.trim() === '' ? null : parseFloat(edit);
  const valid = edit.trim() === '' || !Number.isNaN(num);
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-50 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Editable</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          className="w-32 h-9"
          value={edit}
          onChange={(e) => setEdit(e.target.value)}
          placeholder="Enter amount"
          disabled={disabled}
        />
        <Button size="sm" onClick={() => onSave(valid ? num : null)} disabled={disabled || !valid}>
          {disabled ? 'Saving…' : 'Save'}
        </Button>
        {value != null && <span className="text-xs text-gray-500">Current: {formatCurrency(value)}</span>}
      </div>
    </div>
  );
}

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
  const [editingActivatedBook, setEditingActivatedBook] = useState<{
    id: string;
    box_id: string;
    activated_date: string;
    start_ticket_number: number;
    ticket_count: number;
    note: string | null;
  } | null>(null);
  const [loadingEntryDate, setLoadingEntryDate] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [loadingClose, setLoadingClose] = useState(false);
  const [activeSection, setActiveSection] = useState<'entry' | 'reports'>('entry');
  const [entryTab, setEntryTab] = useState<'boxes' | 'activatedBooks' | 'reports' | 'players'>('boxes');
  const [reportsTab, setReportsTab] = useState<'overview' | 'mismatches' | 'players' | 'weekly' | 'boxManagement' | 'receipts'>('overview');
  const [reportDate, setReportDate] = useState(today);
  const [dailyReportFields, setDailyReportFields] = useState<DailyReportGeneratedFields | null>(null);
  const [loadingReportFields, setLoadingReportFields] = useState(false);
  const [savingRegister, setSavingRegister] = useState(false);
  const [lotteryReportsList, setLotteryReportsList] = useState<any[]>([]);
  const [posReportsList, setPosReportsList] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [reportEntryDate, setReportEntryDate] = useState(today);
  const [instant34Form, setInstant34Form] = useState<{ totalCashes: string }>({ totalCashes: '' });
  const [special50Form, setSpecial50Form] = useState<{
    totalSales: string; seasonTkts: string; discount: string; cancels: string; freeBets: string;
    commission: string; cashes: string; cashBonus: string; claimBonus: string; adjustments: string; serviceFee: string;
  }>({
    totalSales: '', seasonTkts: '', discount: '', cancels: '', freeBets: '',
    commission: '', cashes: '', cashBonus: '', claimBonus: '', adjustments: '', serviceFee: '',
  });
  const [loadingReportForms, setLoadingReportForms] = useState(false);
  const [savingReport34, setSavingReport34] = useState(false);
  const [savingReport50, setSavingReport50] = useState(false);
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

  const loadReportFormsForDate = async (date: string) => {
    setLoadingReportForms(true);
    try {
      const reports = await getLotteryReports(date);
      const { instant34Form: i34, special50Form: s50 } = mapLotteryReportsToForms(reports ?? null);
      setInstant34Form(i34);
      setSpecial50Form(s50);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReportForms(false);
    }
  };

  useEffect(() => {
    if (reportEntryDate) loadReportFormsForDate(reportEntryDate);
  }, [reportEntryDate]);

  const loadDailyReportFields = async (date: string) => {
    setLoadingReportFields(true);
    try {
      const fields = await getDailyReportGeneratedFields(date);
      setDailyReportFields(fields);
    } catch (e) {
      console.error('Failed to load daily report fields:', e);
      setDailyReportFields(null);
    } finally {
      setLoadingReportFields(false);
    }
  };

  const handleSaveCashRegister = async (
    date: string,
    lotteryCashAtRegister: number | null,
    groceryCashAtRegister: number | null
  ) => {
    setSavingRegister(true);
    try {
      await upsertDailyCashRegister(date, { lotteryCashAtRegister, groceryCashAtRegister });
      await loadDailyReportFields(date);
    } catch (e: any) {
      alert(e?.message || 'Failed to save');
    } finally {
      setSavingRegister(false);
    }
  };

  useEffect(() => {
    if (reportsTab === 'overview') loadDailyReportFields(reportDate);
  }, [reportsTab, reportDate]);

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
      openNumber: number | null;
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

  const handleSaveOpenNumbers = async (
    updates: Array<{ boxId: string; openNumber: number | null; newBoxStartNumber?: number | null; activatedBookId?: string | null }>
  ) => {
    if (updates.length === 0) {
      alert('Enter at least one open number.');
      return;
    }
    setLoadingOpen(true);
    try {
      await saveOpenNumbers(entryDate, updates);
      const newEntries = await getDailyBoxEntries(entryDate);
      setEntries(Object.fromEntries(newEntries.map((e) => [e.box_id, e])));
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoadingOpen(false);
    }
  };

  const handleSaveCloseNumbers = async (
    updates: Array<{ boxId: string; closeNumber: number | null }>
  ) => {
    if (updates.length === 0) {
      alert('Enter at least one close number.');
      return;
    }
    setLoadingClose(true);
    try {
      await saveCloseNumbers(entryDate, updates);
      const newEntries = await getDailyBoxEntries(entryDate);
      setEntries(Object.fromEntries(newEntries.map((e) => [e.box_id, e])));
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoadingClose(false);
    }
  };

  const handleSubmitDay = async () => {
    setLoading(true);
    try {
      await markDailyEntriesSubmitted(entryDate);
      setEntrySubmission({ date: entryDate, submitted_at: new Date().toISOString() });
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReport34 = async () => {
    const totalCashes = instant34Form.totalCashes.trim() ? parseFloat(instant34Form.totalCashes) : undefined;
    if (totalCashes == null || isNaN(totalCashes)) {
      alert('Enter Total cashes');
      return;
    }
    setSavingReport34(true);
    try {
      await createLotteryReport(reportEntryDate, 'instant_34', { instantTotal: totalCashes });
      await loadReportFormsForDate(reportEntryDate);
      await loadReceipts();
      alert('Instant Report 34 saved.');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingReport34(false);
    }
  };

  const handleSaveReport50 = async () => {
    const totalSales = special50Form.totalSales.trim() ? parseFloat(special50Form.totalSales) : 0;
    const discount = special50Form.discount.trim() ? parseFloat(special50Form.discount) : 0;
    const cancels = special50Form.cancels.trim() ? parseFloat(special50Form.cancels) : 0;
    const freeBets = special50Form.freeBets.trim() ? parseFloat(special50Form.freeBets) : 0;
    const commission = special50Form.commission.trim() ? parseFloat(special50Form.commission) : 0;
    const cashes = special50Form.cashes.trim() ? parseFloat(special50Form.cashes) : 0;
    const cashBonus = special50Form.cashBonus.trim() ? parseFloat(special50Form.cashBonus) : 0;
    const serviceFee = special50Form.serviceFee.trim() ? parseFloat(special50Form.serviceFee) : 0;
    setSavingReport50(true);
    try {
      await createLotteryReport(reportEntryDate, 'special_50', {
        totalSales: totalSales || undefined,
        seasonTkts: special50Form.seasonTkts.trim() ? parseFloat(special50Form.seasonTkts) : undefined,
        discount: discount || undefined,
        cancels: cancels || undefined,
        freeBets: freeBets || undefined,
        commission: commission || undefined,
        cashValue: cashes || undefined,
        cashBonus: cashBonus || undefined,
        claimsBonus: special50Form.claimBonus.trim() ? parseFloat(special50Form.claimBonus) : undefined,
        adjustments: special50Form.adjustments.trim() ? parseFloat(special50Form.adjustments) : undefined,
        serviceFee: serviceFee || undefined,
      });
      await loadReportFormsForDate(reportEntryDate);
      await loadReceipts();
      alert('Special Report 50 saved.');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingReport50(false);
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
      const isImage = file.type.startsWith('image/');
      const imageUrl = isImage ? await uploadFileClient(supabase, file, 'pos') : undefined;

      await createPOSReport(today, {
        groceryTotal: ocrData.totalSales ?? 0,
        cash: ocrData.cash ?? 0,
        card: ocrData.card ?? 0,
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
                    onSaveOpenNumbers={handleSaveOpenNumbers}
                    onSaveCloseNumbers={handleSaveCloseNumbers}
                    onSubmitDay={handleSubmitDay}
                    loading={loading}
                    loadingOpen={loadingOpen}
                    loadingClose={loadingClose}
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
                {editingActivatedBook && (
                  <Card className="mb-4 border-primary/50">
                    <CardHeader>
                      <CardTitle>Edit activated book</CardTitle>
                      <CardDescription>Update fields and save, or cancel to close.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ActivatedBookEditForm
                        key={editingActivatedBook.id}
                        boxes={boxes}
                        initial={editingActivatedBook}
                        onSave={async (updates) => {
                          try {
                            await updateActivatedBook(editingActivatedBook.id, updates);
                            await loadActivatedBooks();
                            if (editingActivatedBook.activated_date === entryDate) {
                              const forDate = await getActivatedBooksForDate(entryDate);
                              setActivatedBooksForToday(forDate);
                            }
                            setEditingActivatedBook(null);
                          } catch (e) {
                            alert(e instanceof Error ? e.message : 'Failed to update');
                          }
                        }}
                        onCancel={() => setEditingActivatedBook(null)}
                        loading={loading}
                      />
                    </CardContent>
                  </Card>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Box</TableHead>
                      <TableHead>Start #</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>End #</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activatedBooksList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-muted-foreground text-center py-8">
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
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setEditingActivatedBook({
                                      id: row.id,
                                      box_id: row.box_id,
                                      activated_date: row.activated_date,
                                      start_ticket_number: row.start_ticket_number,
                                      ticket_count: row.ticket_count,
                                      note: row.note ?? null,
                                    })
                                  }
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={async () => {
                                    if (!confirm('Delete this activated book? Daily entries linked to it will be unlinked.')) return;
                                    try {
                                      await deleteActivatedBook(row.id);
                                      await loadActivatedBooks();
                                      if (row.activated_date === entryDate) {
                                        const forDate = await getActivatedBooksForDate(entryDate);
                                        setActivatedBooksForToday(forDate);
                                      }
                                    } catch (e) {
                                      alert(e instanceof Error ? e.message : 'Failed to delete');
                                    }
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
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

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold mb-3">Manual entry</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter report values manually or edit after upload. Select date and fill the fields. Calculated fields (Net Sales, Net Due) update automatically.
                  </p>
                  <div className="flex flex-wrap items-end gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin-report-entry-date">Report date</Label>
                      <Input
                        id="admin-report-entry-date"
                        type="date"
                        value={reportEntryDate}
                        onChange={(e) => setReportEntryDate(e.target.value)}
                        max={today}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-lg border p-4 space-y-4">
                      <h4 className="font-medium">Instant Report 34</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="admin-r34-total-cashes">Total cashes</Label>
                          <Input
                            id="admin-r34-total-cashes"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={instant34Form.totalCashes}
                            onChange={(e) => setInstant34Form((p) => ({ ...p, totalCashes: e.target.value }))}
                            disabled={loadingReportForms}
                          />
                        </div>
                      </div>
                      <Button onClick={handleSaveReport34} disabled={savingReport34 || loadingReportForms}>
                        {savingReport34 ? 'Saving…' : 'Save Instant Report 34'}
                      </Button>
                    </div>

                    <div className="rounded-lg border p-4 space-y-4">
                      <h4 className="font-medium">Special Report 50 (Instant Report 50)</h4>
                      <p className="text-xs text-muted-foreground">
                        Net Sales = Total Sales − Discount − Cancels − Free Bets · Net Due = Net Sales − Commission − Cashes − Cash Bonus + Service Fee
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="admin-r50-total-sales">Total Sales</Label>
                          <Input
                            id="admin-r50-total-sales"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={special50Form.totalSales}
                            onChange={(e) => setSpecial50Form((p) => ({ ...p, totalSales: e.target.value }))}
                            disabled={loadingReportForms}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-r50-season-tkts">Season TKTS</Label>
                          <Input
                            id="admin-r50-season-tkts"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={special50Form.seasonTkts}
                            onChange={(e) => setSpecial50Form((p) => ({ ...p, seasonTkts: e.target.value }))}
                            disabled={loadingReportForms}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-r50-discount">Discount</Label>
                          <Input
                            id="admin-r50-discount"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={special50Form.discount}
                            onChange={(e) => setSpecial50Form((p) => ({ ...p, discount: e.target.value }))}
                            disabled={loadingReportForms}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-r50-cancels">Cancels</Label>
                          <Input
                            id="admin-r50-cancels"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={special50Form.cancels}
                            onChange={(e) => setSpecial50Form((p) => ({ ...p, cancels: e.target.value }))}
                            disabled={loadingReportForms}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-r50-free-bets">Free Bets</Label>
                          <Input
                            id="admin-r50-free-bets"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={special50Form.freeBets}
                            onChange={(e) => setSpecial50Form((p) => ({ ...p, freeBets: e.target.value }))}
                            disabled={loadingReportForms}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Net Sales (auto)</Label>
                          <Input
                            readOnly
                            className="bg-muted"
                            value={(() => {
                              const ts = parseFloat(special50Form.totalSales) || 0;
                              const d = parseFloat(special50Form.discount) || 0;
                              const c = parseFloat(special50Form.cancels) || 0;
                              const f = parseFloat(special50Form.freeBets) || 0;
                              return (ts - d - c - f).toFixed(2);
                            })()}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-r50-commission">Commission</Label>
                          <Input
                            id="admin-r50-commission"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={special50Form.commission}
                            onChange={(e) => setSpecial50Form((p) => ({ ...p, commission: e.target.value }))}
                            disabled={loadingReportForms}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-r50-cashes">Cashes</Label>
                          <Input
                            id="admin-r50-cashes"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={special50Form.cashes}
                            onChange={(e) => setSpecial50Form((p) => ({ ...p, cashes: e.target.value }))}
                            disabled={loadingReportForms}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-r50-cash-bonus">Cash Bonus</Label>
                          <Input
                            id="admin-r50-cash-bonus"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={special50Form.cashBonus}
                            onChange={(e) => setSpecial50Form((p) => ({ ...p, cashBonus: e.target.value }))}
                            disabled={loadingReportForms}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-r50-claim-bonus">Claim Bonus</Label>
                          <Input
                            id="admin-r50-claim-bonus"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={special50Form.claimBonus}
                            onChange={(e) => setSpecial50Form((p) => ({ ...p, claimBonus: e.target.value }))}
                            disabled={loadingReportForms}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-r50-adjustments">Adjustments</Label>
                          <Input
                            id="admin-r50-adjustments"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={special50Form.adjustments}
                            onChange={(e) => setSpecial50Form((p) => ({ ...p, adjustments: e.target.value }))}
                            disabled={loadingReportForms}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-r50-service-fee">Service Fee</Label>
                          <Input
                            id="admin-r50-service-fee"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={special50Form.serviceFee}
                            onChange={(e) => setSpecial50Form((p) => ({ ...p, serviceFee: e.target.value }))}
                            disabled={loadingReportForms}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Net Due (auto)</Label>
                          <Input
                            readOnly
                            className="bg-muted"
                            value={(() => {
                              const ts = parseFloat(special50Form.totalSales) || 0;
                              const d = parseFloat(special50Form.discount) || 0;
                              const c = parseFloat(special50Form.cancels) || 0;
                              const f = parseFloat(special50Form.freeBets) || 0;
                              const netSales = ts - d - c - f;
                              const comm = parseFloat(special50Form.commission) || 0;
                              const cashes = parseFloat(special50Form.cashes) || 0;
                              const cashBonus = parseFloat(special50Form.cashBonus) || 0;
                              const serviceFee = parseFloat(special50Form.serviceFee) || 0;
                              return (netSales - comm - cashes - cashBonus + serviceFee).toFixed(2);
                            })()}
                          />
                        </div>
                      </div>
                      <Button onClick={handleSaveReport50} disabled={savingReport50 || loadingReportForms}>
                        {savingReport50 ? 'Saving…' : 'Save Special Report 50'}
                      </Button>
                    </div>
                  </div>
                </div>
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

          {/* Reports Section - Admin Reports Dashboard UI */}
          <TabsContent value="reports" className="mt-0">
            <div className="bg-gray-50 min-h-[60vh] -mx-4 sm:-mx-6 lg:-mx-8 -mb-8 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
              <Tabs value={reportsTab} onValueChange={(v: string) => {
                setReportsTab(v as 'overview' | 'mismatches' | 'players' | 'weekly' | 'boxManagement' | 'receipts');
                if (v === 'mismatches') loadContinuityLogs();
                if (v === 'weekly') loadWeeklyData();
                if (v === 'boxManagement') loadBoxes();
                if (v === 'receipts') loadReceipts();
                if (v === 'overview') loadDailyReportFields(reportDate);
              }} className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
                  <div className="flex border-b border-gray-200">
                    {[
                      { id: 'overview', label: 'Overview' },
                      { id: 'mismatches', label: 'Mismatches' },
                      { id: 'players', label: 'Players' },
                      { id: 'weekly', label: 'Weekly' },
                      { id: 'boxManagement', label: 'Box Management' },
                      { id: 'receipts', label: 'Receipts' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setReportsTab(tab.id as typeof reportsTab)}
                        className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                          reportsTab === tab.id
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="animate-fadeIn">
              <TabsContent value="overview" className="mt-0 space-y-6">
                <div className="space-y-6">
                  {/* Date Control - design card */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-gray-600 mb-2">Report Date</label>
                        <Input
                          id="report-date"
                          type="date"
                          value={reportDate}
                          onChange={(e) => {
                            const d = e.target.value;
                            setReportDate(d);
                            loadDailyReportFields(d);
                          }}
                          max={today}
                          className="w-full max-w-xs"
                        />
                      </div>
                      <Button
                        className="mt-7"
                        onClick={() => loadDailyReportFields(reportDate)}
                        disabled={loadingReportFields}
                      >
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {/* Generated Report Fields - design list */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="p-6 border-b border-gray-200">
                      <h2 className="text-xl font-semibold text-gray-900">Generated Report Fields</h2>
                      <p className="text-sm text-gray-600 mt-1">Report values from daily box entry, lottery reports, and data entry.</p>
                    </div>
                    <div className="p-6">
                      {loadingReportFields && !dailyReportFields && (
                        <div className="text-sm text-gray-500">Loading report…</div>
                      )}
                      {dailyReportFields && (
                        <div className="space-y-3">
                          {[
                            { i: 1, label: 'Scratch Sales Report', value: dailyReportFields.scratchSales, editable: false, highlight: false },
                            { i: 2, label: 'Online ticket sales (net sales from Special Report 50)', value: dailyReportFields.onlineTicketSales, editable: false, highlight: false },
                            { i: 3, label: 'Total lottery sales (1+2)', value: dailyReportFields.totalLotterySales, editable: false, highlight: false },
                            { i: 4, label: 'Total lottery cashing (cashes from Report 34 & 50)', value: dailyReportFields.totalLotteryCashing, editable: false, highlight: false },
                            { i: 5, label: 'Total Lottery Due (3−4)', value: dailyReportFields.totalLotteryDue, editable: false, highlight: false },
                            { i: 6, label: 'Total Daily Udhari (net of players)', value: dailyReportFields.totalDailyUdhari, editable: false, highlight: false },
                            { i: 7, label: 'Lottery cash in Hand (5−6)', value: dailyReportFields.lotteryCashInHand, editable: false, highlight: false },
                          ].map((field) => (
                            <div
                              key={field.i}
                              className={`flex items-center justify-between py-3 px-4 rounded-lg ${field.highlight ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50'}`}
                            >
                              <span className="text-sm text-gray-700">{field.i}. {field.label}</span>
                              <span className="font-semibold text-gray-900">{formatCurrency(field.value)}</span>
                            </div>
                          ))}
                          <ReportFieldRowEditableList
                            label="8. Lottery cash at register (data entry)"
                            value={dailyReportFields.lotteryCashAtRegister}
                            onSave={(val) => handleSaveCashRegister(reportDate, val, dailyReportFields.totalGroceryCashAtRegister ?? null)}
                            disabled={savingRegister}
                          />
                          <ReportFieldRowEditableList
                            label="9. Total grocery cash at register (data entry or POS)"
                            value={dailyReportFields.totalGroceryCashAtRegister}
                            onSave={(val) => handleSaveCashRegister(reportDate, dailyReportFields.lotteryCashAtRegister ?? null, val)}
                            disabled={savingRegister}
                          />
                          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-blue-50 border-2 border-blue-200">
                            <span className="text-sm font-semibold text-gray-900">10. Total cash in hand daily for pickup (7+9)</span>
                            <span className="text-xl font-semibold text-blue-600">{formatCurrency(dailyReportFields.totalCashInHandDailyForPickup)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expected Cash by Date Range - design card */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Expected Cash by Date Range</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <Label htmlFor="dateFrom" className="text-sm text-gray-600">From Date</Label>
                        <Input id="dateFrom" type="date" value={dateRangeFrom} onChange={(e) => setDateRangeFrom(e.target.value)} max={today} className="mt-2" />
                      </div>
                      <div>
                        <Label htmlFor="dateTo" className="text-sm text-gray-600">To Date</Label>
                        <Input id="dateTo" type="date" value={dateRangeTo} onChange={(e) => setDateRangeTo(e.target.value)} max={today} className="mt-2" />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={loadDateRangeSummary} disabled={loadingRange || !dateRangeFrom || !dateRangeTo} className="w-full">
                          {loadingRange ? 'Calculating...' : 'Calculate'}
                        </Button>
                      </div>
                    </div>
                    {rangeSummary && (
                      <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                        <p className="text-sm text-gray-600 mb-2">Expected Cash for {formatDate(dateRangeFrom)} to {formatDate(dateRangeTo)}</p>
                        <p className="text-4xl font-bold text-gray-900 mb-4">{formatCurrency(rangeSummary.expectedCash)}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div><p className="text-gray-600">Scratch Sales</p><p className="font-semibold text-gray-900">{formatCurrency(rangeSummary.scratchSales)}</p></div>
                          <div><p className="text-gray-600">Online Sales</p><p className="font-semibold text-gray-900">{formatCurrency(rangeSummary.onlineSales)}</p></div>
                          <div><p className="text-gray-600">Grocery Sales</p><p className="font-semibold text-gray-900">{formatCurrency(rangeSummary.grocerySales)}</p></div>
                          <div><p className="text-gray-600">Lottery Cashes</p><p className="font-semibold text-gray-900">{formatCurrency(rangeSummary.lotteryCashes)}</p></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* KPI Row - design KPICards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPICard title="Today Expected Cash" value={formatCurrency(initialSummary.expectedCash)} icon={DollarSign} variant="success" />
                    <KPICard title="Lottery Due" value={formatCurrency(lotteryDue)} icon={TrendingUp} variant="default" />
                    <KPICard title="Outstanding Credit" value={formatCurrency(outstandingCredit)} icon={AlertCircle} variant="warning" />
                    <KPICard title="Boxes Mismatched" value={mismatchCount} icon={BoxIcon} variant="danger" subtitle={mismatchCount > 0 ? 'Requires attention' : undefined} />
                  </div>

                  {/* Daily Sales Breakdown - design list + PieChart */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Sales Breakdown</h3>
                    <p className="text-sm text-gray-600 mb-4">{formatDate(initialSummary.date)}</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        {[
                          { name: 'Scratch Sales', value: initialSummary.scratchSales, fill: '#3b82f6' },
                          { name: 'Online Sales', value: initialSummary.onlineSales, fill: '#10b981' },
                          { name: 'Grocery Sales', value: initialSummary.grocerySales, fill: '#f59e0b' },
                          { name: 'Lottery Cashes', value: initialSummary.lotteryCashes, fill: '#ef4444' },
                        ].map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: item.fill }} />
                              <span className="text-sm text-gray-700">{item.name}</span>
                            </div>
                            <span className="font-semibold text-gray-900">{formatCurrency(item.value)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                          <span className="text-sm font-semibold text-gray-900">Player Balance</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(initialSummary.playerBalance)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Scratch Sales', value: initialSummary.scratchSales, fill: '#3b82f6' },
                                { name: 'Online Sales', value: initialSummary.onlineSales, fill: '#10b981' },
                                { name: 'Grocery Sales', value: initialSummary.grocerySales, fill: '#f59e0b' },
                                { name: 'Lottery Cashes', value: initialSummary.lotteryCashes, fill: '#ef4444' },
                              ].filter((d) => d.value > 0)}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={100}
                              dataKey="value"
                            >
                              {[
                                { name: 'Scratch Sales', value: initialSummary.scratchSales, fill: '#3b82f6' },
                                { name: 'Online Sales', value: initialSummary.onlineSales, fill: '#10b981' },
                                { name: 'Grocery Sales', value: initialSummary.grocerySales, fill: '#f59e0b' },
                                { name: 'Lottery Cashes', value: initialSummary.lotteryCashes, fill: '#ef4444' },
                              ]
                                .filter((d) => d.value > 0)
                                .map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="mismatches" className="mt-0 space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Ticket Continuity Logs</h2>
                    <p className="text-sm text-gray-600 mt-1">Mismatches between closing and opening ticket numbers</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Box</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Previous Close</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Today Open</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Difference</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Severity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {continuityLogs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                              No mismatches found
                            </td>
                          </tr>
                        ) : (
                          continuityLogs.map((log, index) => (
                            <tr key={log.id} className={index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}>
                              <td className="px-6 py-4 text-sm text-gray-900">{formatDate(log.date)}</td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{log.boxes.name}</td>
                              <td className="px-6 py-4 text-sm font-mono text-gray-700">{log.prev_close}</td>
                              <td className="px-6 py-4 text-sm font-mono text-gray-700">{log.today_open}</td>
                              <td className="px-6 py-4 text-sm font-semibold text-gray-900">{log.difference}</td>
                              <td className="px-6 py-4 text-sm">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  log.severity === 'critical' ? 'bg-red-100 text-red-800 border border-red-300' :
                                  log.severity === 'error' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                                  'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                }`}>
                                  {log.severity.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="players" className="mt-0 space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Player Balances</h2>
                    <p className="text-sm text-gray-600 mt-1">Daily activities and current credit balances for all players</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Player Name</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Played Balance</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Win Balance</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Paid Balance</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Balance Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {playerDailyActivities.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No players found</td>
                          </tr>
                        ) : (
                          playerDailyActivities.map((activity) => (
                            <tr key={activity.playerId} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{activity.name}</td>
                              <td className="px-6 py-4 text-sm text-right font-medium text-blue-600">
                                {activity.playedBalance > 0 ? `+${formatCurrency(activity.playedBalance)}` : '—'}
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-medium text-green-600">
                                {activity.winBalance > 0 ? `-${formatCurrency(activity.winBalance)}` : '—'}
                              </td>
                              <td className="px-6 py-4 text-sm text-right font-medium text-purple-600">
                                {activity.paidBalance > 0 ? `-${formatCurrency(activity.paidBalance)}` : '—'}
                              </td>
                              <td className="px-6 py-4 text-sm text-right">
                                <span className={`font-semibold ${activity.totalBalanceDue < 0 ? 'text-red-600' : activity.totalBalanceDue > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                                  {formatCurrency(activity.totalBalanceDue)}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {playerDailyActivities.length > 0 && (
                    <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-t border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-1">Total Played Today</p>
                          <p className="text-2xl font-bold text-blue-600">{formatCurrency(playerDailyActivities.reduce((sum, a) => sum + a.playedBalance, 0))}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-1">Total Wins Today</p>
                          <p className="text-2xl font-bold text-green-600">{formatCurrency(playerDailyActivities.reduce((sum, a) => sum + a.winBalance, 0))}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-1">Total Paid Today</p>
                          <p className="text-2xl font-bold text-purple-600">{formatCurrency(playerDailyActivities.reduce((sum, a) => sum + a.paidBalance, 0))}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-1">Total Outstanding</p>
                          <p className={`text-2xl font-bold ${playerDailyActivities.reduce((sum, a) => sum + Math.max(0, a.totalBalanceDue), 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatCurrency(playerDailyActivities.reduce((sum, a) => sum + Math.max(0, a.totalBalanceDue), 0))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="weekly" className="mt-0 space-y-6">
                <div className="space-y-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Weekly Cash Flow</h3>
                    <p className="text-sm text-gray-600 mb-4">Expected cash over the last 7 days</p>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} stroke="#6b7280" />
                        <YAxis stroke="#6b7280" tickFormatter={(value) => `$${value}`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => formatDate(label)} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                        <Line type="monotone" dataKey="expectedCash" stroke="#3b82f6" name="Expected Cash" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} activeDot={{ r: 7 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Weekly Sales Breakdown</h3>
                    <p className="text-sm text-gray-600 mb-4">Sales by category over the last 7 days</p>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} stroke="#6b7280" />
                        <YAxis stroke="#6b7280" tickFormatter={(value) => `$${value}`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                        <Legend />
                        <Bar dataKey="scratchSales" fill="#3b82f6" name="Scratch Sales" />
                        <Bar dataKey="onlineSales" fill="#10b981" name="Online Sales" />
                        <Bar dataKey="grocerySales" fill="#f59e0b" name="Grocery Sales" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Weekly Summary</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Scratch</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Online</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Grocery</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Expected Cash</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {weeklyData.map((day, index) => (
                            <tr key={day.date} className={index === weeklyData.length - 1 ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatDate(day.date)}</td>
                              <td className="px-6 py-4 text-sm text-right font-medium text-blue-600">{formatCurrency(day.scratchSales)}</td>
                              <td className="px-6 py-4 text-sm text-right font-medium text-green-600">{formatCurrency(day.onlineSales)}</td>
                              <td className="px-6 py-4 text-sm text-right font-medium text-amber-600">{formatCurrency(day.grocerySales)}</td>
                              <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">{formatCurrency(day.expectedCash)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
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

              <TabsContent value="receipts" className="mt-0 space-y-6">
                <div className="space-y-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-900">Uploaded Receipts</h2>
                    <p className="text-sm text-gray-600 mt-1">View all uploaded lottery and POS receipts</p>
                  </div>
                  <div className="space-y-6">
                  {/* Lottery Reports */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">Lottery Reports</h3>
                    {lotteryReportsList.length === 0 ? (
                      <p className="text-gray-500">No lottery reports uploaded yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {lotteryReportsList.map((report) => (
                          <Card key={report.id} className="overflow-hidden hover:shadow-lg transition-all hover:scale-105 border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
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
                  <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6">POS Terminal Receipts</h3>
                    {posReportsList.length === 0 ? (
                      <p className="text-gray-500">No POS receipts uploaded yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {posReportsList.map((report) => (
                          <Card key={report.id} className="overflow-hidden hover:shadow-lg transition-all hover:scale-105 border border-green-200 bg-gradient-to-br from-green-50 to-green-100">
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
                </div>
              </TabsContent>
                </div>
              </Tabs>
            </div>
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
  onSaveOpenNumbers,
  onSaveCloseNumbers,
  onSubmitDay,
  loading,
  loadingOpen,
  loadingClose,
  isAdmin = true,
  isSubmitted = false,
}: {
  boxes: Box[];
  entries: Record<string, Entry>;
  today: string;
  activatedBooksForDate?: ActivatedBookForDate[];
  onSaveAll: (updates: Array<{
    boxId: string;
    openNumber: number | null;
    closeNumber: number | null;
    newBoxStartNumber?: number | null;
    activatedBookId?: string | null;
  }>) => void;
  onSaveOpenNumbers?: (updates: Array<{ boxId: string; openNumber: number | null; newBoxStartNumber?: number | null; activatedBookId?: string | null }>) => void;
  onSaveCloseNumbers?: (updates: Array<{ boxId: string; closeNumber: number | null }>) => void;
  onSubmitDay?: () => void;
  loading: boolean;
  loadingOpen?: boolean;
  loadingClose?: boolean;
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

  // Sold semantics: 0 = valid value (1 ticket); "-" = null (no ticket). Helpers from @/lib/utils/entries
  const [formValues, setFormValues] = useState<Record<string, { open: string; close: string; newBoxStart: string }>>(
    () =>
      Object.fromEntries(
        sortedBoxes.map((box) => {
          const entry = entries[box.id];
          const activatedBook = activatedBooksByBox[box.id];
          const newBoxStart =
            entry?.new_box_start_number?.toString() ??
            (activatedBook ? String(activatedBook.start_ticket_number) : '');
          return [
            box.id,
            {
              open: openDisplay(entry),
              close: closeDisplay(entry),
              newBoxStart,
            },
          ];
        })
      )
  );

  // Stable key so sync effect only runs when server data (entries/boxes/activatedBooks) actually changes — not on every render (which would overwrite user typing)
  const entriesSyncKey = useMemo(
    () =>
      sortedBoxes
        .map((b) => {
          const e = entries[b.id];
          const ab = activatedBooksByBox[b.id];
          const n = e?.new_box_start_number ?? ab?.start_ticket_number ?? '';
          return `${e?.open_number ?? '-'}|${e?.close_number ?? '-'}|${n}`;
        })
        .join(';'),
    [entries, activatedBooksForDate, boxes]
  );
  useEffect(() => {
    setFormValues((prev) => {
      const next = { ...prev };
      let changed = false;
      sortedBoxes.forEach((box) => {
        const entry = entries[box.id];
        const activatedBook = activatedBooksByBox[box.id];
        const open = openDisplay(entry);
        const close = closeDisplay(entry);
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
  }, [entriesSyncKey]);

  const setBoxValue = (boxId: string, field: 'open' | 'close' | 'newBoxStart', value: string) => {
    if (field === 'open' || field === 'close') {
      if (value !== '-' && value !== '') {
        const n = parseFloat(value);
        if (!Number.isNaN(n) && n < 0) value = '0';
      }
    }
    setFormValues((prev) => {
      const current = prev[boxId] ?? { open: '', close: '', newBoxStart: '' };
      const next = { open: current.open, close: current.close, newBoxStart: current.newBoxStart };
      next[field] = value;
      return { ...prev, [boxId]: next };
    });
  };

  const handleSaveAll = () => {
    const updates: Array<{
      boxId: string;
      openNumber: number | null;
      closeNumber: number | null;
      newBoxStartNumber?: number | null;
      activatedBookId?: string | null;
    }> = [];
    sortedBoxes.forEach((box) => {
      const v = formValues[box.id];
      if (!v) return;
      if (v.open.trim() === '' && v.close.trim() === '' && v.newBoxStart.trim() === '') return;
      const openNum = parseOpenClose(v.open);
      const closeNum = parseOpenClose(v.close);
      const rawNewBox = v.newBoxStart.trim() ? parseInt(v.newBoxStart, 10) : null;
      const newBoxStartNum = rawNewBox != null && !Number.isNaN(rawNewBox) ? rawNewBox : null;
      const activatedBook = activatedBooksByBox[box.id];
      const activatedBookId =
        activatedBook && newBoxStartNum !== null && newBoxStartNum === activatedBook.start_ticket_number
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
      alert('Enter at least one value (number or -) for open or close.');
      return;
    }
    onSaveAll(updates);
  };

  const handleSaveOpenNumbers = () => {
    if (!onSaveOpenNumbers) return;
    const updates: Array<{ boxId: string; openNumber: number | null; newBoxStartNumber?: number | null; activatedBookId?: string | null }> = [];
    sortedBoxes.forEach((box) => {
      const v = formValues[box.id];
      if (!v || v.open.trim() === '') return;
      const openNum = parseOpenClose(v.open);
      const rawNewBox = v.newBoxStart.trim() ? parseInt(v.newBoxStart, 10) : null;
      const newBoxStartNum = rawNewBox != null && !Number.isNaN(rawNewBox) ? rawNewBox : null;
      const activatedBook = activatedBooksByBox[box.id];
      const activatedBookId =
        activatedBook && newBoxStartNum !== null && newBoxStartNum === activatedBook.start_ticket_number ? activatedBook.id : null;
      updates.push({ boxId: box.id, openNumber: openNum, newBoxStartNumber: newBoxStartNum, activatedBookId: activatedBookId ?? undefined });
    });
    if (updates.length === 0) {
      alert('Enter at least one open value (number or -).');
      return;
    }
    onSaveOpenNumbers(updates);
  };

  const handleSaveCloseNumbers = () => {
    if (!onSaveCloseNumbers) return;
    const updates: Array<{ boxId: string; closeNumber: number | null }> = [];
    sortedBoxes.forEach((box) => {
      const v = formValues[box.id];
      if (!v || v.close.trim() === '') return;
      const closeNum = parseOpenClose(v.close);
      updates.push({ boxId: box.id, closeNumber: closeNum });
    });
    if (updates.length === 0) {
      alert('Enter at least one close value (number or -).');
      return;
    }
    onSaveCloseNumbers(updates);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Box Entry — {today}</CardTitle>
        <CardDescription>
          {readOnly
            ? 'This date has been submitted. Only admin can edit.'
            : 'Tickets are 0-based. Enter Open # and Close #, or "-" when the box was not refilled (tickets finished). Sold and Amount update as you type and after Save.'}
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
                      <TableHead className="sticky right-[5.5rem] min-w-[4.5rem] w-24 bg-muted/80 backdrop-blur-sm z-10 border-l font-semibold text-foreground">
                        Sold <span className="text-[10px] font-normal text-muted-foreground">(live)</span>
                      </TableHead>
                      <TableHead className="sticky right-0 min-w-[5.5rem] w-28 bg-muted/80 backdrop-blur-sm z-10 border-l font-semibold text-foreground">
                        Amount <span className="text-[10px] font-normal text-muted-foreground">(live)</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
            <TableBody>
              {sortedBoxes.map((box) => {
                const entry = entries[box.id];
                const raw = formValues[box.id];
                const v = {
                  open: raw?.open ?? '',
                  close: raw?.close ?? '',
                  newBoxStart: raw?.newBoxStart ?? '',
                };
                const openNum = parseOpenClose(v.open);
                const closeNum = parseOpenClose(v.close);
                const newBoxStartNum = (v.newBoxStart || '').trim() ? parseInt(v.newBoxStart, 10) : null;
                // Always compute from current form so Sold/Amount update live before saving
                const openVal = openNum ?? 0;
                const closeVal = closeNum ?? 0;
                const sold =
                  newBoxStartNum != null && !Number.isNaN(newBoxStartNum)
                    ? newBoxStartNum + openVal - closeVal
                    : closeVal - openVal;
                const amount = box.ticket_value != null ? sold * box.ticket_value : null;
                return (
                  <TableRow key={box.id}>
                    <TableCell className="font-medium">
                      {box.box_number != null ? box.box_number : '—'}
                    </TableCell>
                    <TableCell>{box.name}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <div
                          className="min-h-9 w-20 flex items-center text-xs tabular-nums text-muted-foreground border border-transparent"
                          title="New box start # (from activated book — view only)"
                        >
                          {v.newBoxStart ? v.newBoxStart : '—'}
                        </div>
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
                        type="text"
                        inputMode="numeric"
                        placeholder="Open or -"
                        className="w-24 h-9"
                        value={v.open}
                        onChange={(e) => setBoxValue(box.id, 'open', e.target.value)}
                        disabled={readOnly}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Close or -"
                        className="w-24 h-9"
                        value={v.close}
                        onChange={(e) => setBoxValue(box.id, 'close', e.target.value)}
                        disabled={readOnly}
                      />
                    </TableCell>
                    <TableCell
                      className="sticky right-[5.5rem] min-w-[4.5rem] tabular-nums font-semibold text-foreground bg-muted/80 backdrop-blur-sm z-10 border-l px-3 py-2 rounded-l border border-border/50"
                      title="Auto: tickets sold (from open/close/new box)"
                    >
                      {sold !== null ? sold : '—'}
                    </TableCell>
                    <TableCell
                      className="sticky right-0 min-w-[5.5rem] tabular-nums font-semibold text-foreground bg-muted/80 backdrop-blur-sm z-10 border-l px-3 py-2 rounded-r border border-border/50"
                      title="Auto: Sold × ticket value"
                    >
                      {amount !== null ? formatCurrency(amount) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!readOnly && (onSaveOpenNumbers != null || onSaveCloseNumbers != null) && (
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={4} className="text-muted-foreground text-xs">
                    Save when store opens / closes (one-time)
                  </TableCell>
                  <TableCell className="align-middle">
                    {onSaveOpenNumbers && (
                      <Button size="sm" variant="secondary" onClick={handleSaveOpenNumbers} disabled={loadingOpen}>
                        {loadingOpen ? 'Saving…' : 'Save open numbers'}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="align-middle">
                    {onSaveCloseNumbers && (
                      <Button size="sm" variant="secondary" onClick={handleSaveCloseNumbers} disabled={loadingClose}>
                        {loadingClose ? 'Saving…' : 'Save close numbers'}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            {onSubmitDay && (
              <Button variant="outline" onClick={onSubmitDay} disabled={loading}>
                {loading ? 'Submitting…' : 'Submit day'}
              </Button>
            )}
            {isAdmin && (
              <Button onClick={handleSaveAll} disabled={loading}>
                {loading ? 'Saving…' : 'Save all entries'}
              </Button>
            )}
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

function ActivatedBookEditForm({
  boxes,
  initial,
  onSave,
  onCancel,
  loading,
}: {
  boxes: Box[];
  initial: { box_id: string; activated_date: string; start_ticket_number: number; ticket_count: number; note: string | null };
  onSave: (updates: { boxId?: string; activatedDate?: string; startTicketNumber?: number; ticketCount?: number; note?: string | null }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}) {
  const sortedBoxes = [...boxes].sort((a, b) => (a.box_number ?? 999) - (b.box_number ?? 999));
  const [boxId, setBoxId] = useState(initial.box_id);
  const [activatedDate, setActivatedDate] = useState(initial.activated_date);
  const [startTicketNumber, setStartTicketNumber] = useState(String(initial.start_ticket_number));
  const [ticketCount, setTicketCount] = useState(String(initial.ticket_count));
  const [note, setNote] = useState(initial.note ?? '');

  const handleSubmit = async () => {
    const start = parseInt(startTicketNumber, 10);
    const count = parseInt(ticketCount, 10);
    if (!boxId || isNaN(start) || isNaN(count) || count < 1) {
      alert('Select a box and enter a valid start number and ticket count.');
      return;
    }
    await onSave({
      boxId,
      activatedDate,
      startTicketNumber: start,
      ticketCount: count,
      note: note.trim() || null,
    });
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
          <Label>Start ticket # (0-based)</Label>
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
      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={loading}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
      </div>
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
      let extracted: { totalSales?: number; cash?: number; card?: number };

      if (isPOSSpreadsheetFile(selectedFile)) {
        const name = selectedFile.name.toLowerCase();
        if (name.endsWith('.csv')) {
          const text = await selectedFile.text();
          extracted = parseCSVForPOS(text);
        } else {
          const buffer = await selectedFile.arrayBuffer();
          extracted = await parseExcelForPOS(buffer);
        }
        if (!extracted.totalSales && !extracted.cash && !extracted.card) {
          setError('Could not find Grocery Total, Cash, or Card columns. Use headers: total (or grocery total), cash, card.');
          setProcessing(false);
          return;
        }
      } else if (isPDFFile(selectedFile)) {
        const buffer = await selectedFile.arrayBuffer();
        const text = await extractTextFromPDF(buffer);
        extracted = parsePOSReport(text);
        if (!extracted.totalSales && !extracted.cash && !extracted.card) {
          setError('Could not extract Total, Cash, or Card from PDF. Ensure the receipt contains those labels and amounts.');
          setProcessing(false);
          return;
        }
      } else {
        extracted = await processPOSReportImage(selectedFile);
        if (!extracted.totalSales && !extracted.cash && !extracted.card) {
          setError('Could not extract values from image. Please try again or check image quality.');
          setProcessing(false);
          return;
        }
      }

      setOcrData(extracted);
      await onUpload(selectedFile, extracted);
      setTimeout(() => {
        setFile(null);
        setOcrData(null);
        if (e.target) e.target.value = '';
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to process file. Please try again.');
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
          accept="image/*,.csv,.xlsx,.xls,.pdf"
          onChange={handleFileChange}
          disabled={disabled || processing}
          className="cursor-pointer"
        />
        <p className="text-xs text-muted-foreground">
          Upload image (OCR), PDF, CSV, or Excel (.xlsx, .xls). CSV/Excel: headers Total, Cash, Card. PDF/image: text with Total, Cash, Card.
        </p>
        {processing && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="animate-pulse">⏳</span>
            {file?.type.startsWith('image/') ? 'Processing image and extracting values...' : file?.type === 'application/pdf' ? 'Extracting text from PDF...' : 'Parsing file...'}
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
                  {ocrData.totalSales != null ? formatCurrency(ocrData.totalSales) : '—'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Cash:</span>
                <div className="font-semibold">
                  {ocrData.cash != null ? formatCurrency(ocrData.cash) : '—'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Card:</span>
                <div className="font-semibold">
                  {ocrData.card != null ? formatCurrency(ocrData.card) : '—'}
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
