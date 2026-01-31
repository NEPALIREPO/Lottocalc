/**
 * Parse CSV or Excel files for POS terminal receipt data.
 * Expects columns like: grocery total / total, cash, card (names case-insensitive).
 * Uses exceljs for .xlsx/.xls (no dependency on vulnerable xlsx/SheetJS).
 */

import ExcelJS from 'exceljs';

export interface POSParsedData {
  totalSales?: number;
  cash?: number;
  card?: number;
}

function normalizeNum(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const s = String(value).replace(/[,$\s]/g, '');
  const n = parseFloat(s);
  return Number.isNaN(n) ? undefined : n;
}

function findColumnIndex(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => String(h).trim().toLowerCase());
  for (const name of names) {
    const n = name.toLowerCase();
    const idx = lower.findIndex((h) => h === n || h.includes(n) || n.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Parse CSV text. First row = headers. Uses first data row (or last non-empty row) for totals. */
export function parseCSVForPOS(csvText: string): POSParsedData {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return {};

  const parseRow = (row: string): string[] => {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === ',' || c === '\t') && !inQuotes) {
        out.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    out.push(current.trim());
    return out;
  };

  const headers = parseRow(lines[0]);
  const totalCol = findColumnIndex(headers, 'grocery total', 'grocery_total', 'total', 'total sales', 'sales', 'grocery');
  const cashCol = findColumnIndex(headers, 'cash');
  const cardCol = findColumnIndex(headers, 'card', 'credit');

  // Use last non-empty data row (often the totals row)
  let dataRow = parseRow(lines[1]);
  for (let i = 2; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    const hasNum = row.some((c) => normalizeNum(c) != null);
    if (hasNum) dataRow = row;
  }

  const result: POSParsedData = {};
  if (totalCol >= 0 && dataRow[totalCol] != null) result.totalSales = normalizeNum(dataRow[totalCol]);
  if (cashCol >= 0 && dataRow[cashCol] != null) result.cash = normalizeNum(dataRow[cashCol]);
  if (cardCol >= 0 && dataRow[cardCol] != null) result.card = normalizeNum(dataRow[cardCol]);

  return result;
}

/** Build 0-based row array from ExcelJS row (1-based values). */
function rowToArray(row: ExcelJS.Row): unknown[] {
  const arr: unknown[] = [];
  const cellCount = row.cellCount ?? 0;
  for (let col = 1; col <= cellCount; col++) {
    try {
      const cell = row.getCell(col);
      arr.push(cell.value ?? '');
    } catch {
      arr.push('');
    }
  }
  return arr;
}

/** Parse Excel (xlsx/xls) buffer. First sheet, first row = headers. */
export async function parseExcelForPOS(buffer: ArrayBuffer): Promise<POSParsedData> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return {};

    const data: unknown[][] = [];
    worksheet.eachRow((row) => {
      data.push(rowToArray(row));
    });
    if (data.length < 2) return {};

    const headers = (data[0] as unknown[]).map((h) => String(h ?? '').trim());
    const totalCol = findColumnIndex(headers, 'grocery total', 'grocery_total', 'total', 'total sales', 'sales', 'grocery');
    const cashCol = findColumnIndex(headers, 'cash');
    const cardCol = findColumnIndex(headers, 'card', 'credit');

    let dataRow = (data[1] as unknown[]) ?? [];
    for (let i = 2; i < data.length; i++) {
      const row = (data[i] as unknown[]) ?? [];
      const hasNum = row.some((c) => normalizeNum(c) != null);
      if (hasNum) dataRow = row;
    }

    const result: POSParsedData = {};
    if (totalCol >= 0 && dataRow[totalCol] != null) result.totalSales = normalizeNum(dataRow[totalCol]);
    if (cashCol >= 0 && dataRow[cashCol] != null) result.cash = normalizeNum(dataRow[cashCol]);
    if (cardCol >= 0 && dataRow[cardCol] != null) result.card = normalizeNum(dataRow[cardCol]);

    return result;
  } catch {
    return {};
  }
}

export function isPOSSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');
}

export function isPOSImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}
