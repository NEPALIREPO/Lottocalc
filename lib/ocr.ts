import { createWorker } from 'tesseract.js';

export interface OCRResult {
  ticketCount?: number;
  totalSales?: number; // For Report 34: total amount cashed out; For Report 50: net sales
  netSales?: number; // Net sales (total sales - discounts - cancels - free bets) - Special Report 50
  netDue?: number;
  cash?: number;
  card?: number;
  commission?: number;
  // Special Report 50 fields
  eventCount?: number;
  eventValue?: number;
  totalSalesOnline?: number; // Total sales (tickets sold online - income) - Special Report 50
  cashCount?: number;
  cashValue?: number;
  cashBonus?: number;
  claimsBonus?: number;
  adjustments?: number;
  serviceFee?: number;
}

export async function extractTextFromImage(imageFile: File): Promise<string> {
  const worker = await createWorker('eng');
  const { data } = await worker.recognize(imageFile);
  await worker.terminate();
  return data.text;
}

function normalizeAmount(raw: string): number {
  const s = raw.trim();
  // Remove all commas and periods, then divide by 100
  // Example: "3,445.00" -> "344500" -> 344500 / 100 = 3445.00
  const digitsOnly = s.replace(/[,.]/g, '');
  if (digitsOnly) {
    return parseInt(digitsOnly, 10) / 100;
  }
  return 0;
}

function extractRightSideValue(text: string, label: string): number | undefined {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const labelRegex = new RegExp(`\\b${label}\\b`, 'i');
    if (labelRegex.test(line)) {
      // Extract all digits from the right side (remove commas, periods, dollar signs)
      // Values are stored as integers (e.g., 344500 for 3,445.00), divide by 100
      // Match: digits with optional commas/periods, prefer longer matches
      const moneyLike = line.match(/\$?([\d,]+\.?\d*)\b/g);
      if (moneyLike?.length) {
        // Take the rightmost/last match (usually the value on the right side)
        const last = moneyLike[moneyLike.length - 1].replace(/^\$/, '').trim();
        // Remove all non-digits, then divide by 100
        const digitsOnly = last.replace(/[^\d]/g, '');
        if (digitsOnly.length >= 2) { // At least 2 digits (for cents)
          return parseInt(digitsOnly, 10) / 100;
        }
      }
      // Alternative: match any sequence of digits (more flexible)
      const digitSequences = line.match(/\d{3,}/g); // Match sequences of 3+ digits
      if (digitSequences?.length) {
        const last = digitSequences[digitSequences.length - 1];
        if (last.length >= 2) {
          return parseInt(last, 10) / 100;
        }
      }
    }
  }
  return undefined;
}

export function parseLotteryReport(text: string, reportType?: 'instant_34' | 'special_50'): OCRResult {
  const result: OCRResult = {};
  
  if (reportType === 'instant_34') {
    // Report 34: Daily cash out to players from online
    // Extract number of tickets cashed out
    const ticketCountMatch =
      text.match(/(?:no\.?\s*of\s*tickets?\s*cashed\s*out|number\s*of\s*tickets?\s*cashed\s*out|tickets?\s*cashed\s*out)[:\s]*(\d+)/i) ||
      text.match(/(?:ticket\s*count|count)[:\s]*(\d+)/i);
    if (ticketCountMatch) {
      result.ticketCount = parseInt(ticketCountMatch[1], 10);
    }

    // Extract total amount cashed out: value is stated on the RIGHT side of "totals"
    let totalMatch =
      text.match(/(?:total\s*amount\s*cashed\s*out|amount\s*cashed\s*out|total\s*cashed\s*out)[:\s]*\$?([\d,]+[.,]?\d*)/i) ||
      text.match(/(?:totals?)(?:\s*[\s.:\-]+)\s*\$?([\d,]+[.,]?\d*)/i) ||
      text.match(/(?:totals?)[:\s]*\$?([\d,]+[.,]?\d*)/i) ||
      text.match(/(?:total(?:\s*sales)?)[:\s]*\$?([\d,]+[.,]?\d*)/i);

    // Fallback: value on right side of "totals"
    if (!totalMatch) {
      const rightValue = extractRightSideValue(text, 'totals?');
      if (rightValue !== undefined) {
        result.totalSales = rightValue;
      }
    } else {
      result.totalSales = normalizeAmount(totalMatch[1]);
    }

    // Extract net due (optional)
    const netDueMatch = text.match(/(?:net\s*due|due)[:\s]*\$?([\d,]+[.,]?\d*)/i);
    if (netDueMatch) {
      result.netDue = normalizeAmount(netDueMatch[1]);
    }
  } else if (reportType === 'special_50') {
    // Special Report 50: Extract all fields
    
    // 1. Count (event count) - left side, value on right side of row
    // Format: x,xxx,xxx.xx (commas as thousands separators)
    const countMatch = text.match(/\bcount\b[:\s]*(\d+)/i);
    if (countMatch) {
      result.eventCount = parseInt(countMatch[1], 10);
      // Event value: right side of count row - extract digits, remove commas/periods, divide by 100
      const countLine = text.split(/\r?\n/).find(line => /\bcount\b/i.test(line));
      if (countLine) {
        // Match digits with commas/periods at the end of the line
        const valueMatch = countLine.match(/\$?([\d,]+\.?\d*)\s*$/);
        if (valueMatch) {
          result.eventValue = normalizeAmount(valueMatch[1]);
        }
      }
    }

    // 2. Total sales: number of tickets sold online (income)
    // Extract digits, remove commas/periods, divide by 100
    const totalSalesMatch =
      text.match(/(?:total\s*sales)[:\s]*\$?([\d,]+\.?\d*)\b/i) ||
      text.match(/(?:sales)[:\s]*\$?([\d,]+\.?\d*)\b/i);
    if (totalSalesMatch) {
      result.totalSalesOnline = normalizeAmount(totalSalesMatch[1]);
    } else {
      // Fallback: right side of "total sales" line
      const rightValue = extractRightSideValue(text, 'total\\s*sales');
      if (rightValue !== undefined) {
        result.totalSalesOnline = rightValue;
      }
    }

    // 3. Net sales: total sales - discounts - cancels - free bets
    // Extract digits, remove commas/periods, divide by 100
    const netSalesMatch = text.match(/(?:net\s*sales)[:\s]*\$?([\d,]+\.?\d*)\b/i);
    if (netSalesMatch) {
      result.netSales = normalizeAmount(netSalesMatch[1]);
    } else {
      const rightValue = extractRightSideValue(text, 'net\\s*sales');
      if (rightValue !== undefined) {
        result.netSales = rightValue;
      }
    }

    // 4. Commission
    // Extract digits, remove commas/periods, divide by 100
    const commissionMatch = text.match(/(?:commission)[:\s]*\$?([\d,]+\.?\d*)\b/i);
    if (commissionMatch) {
      result.commission = normalizeAmount(commissionMatch[1]);
    } else {
      const rightValue = extractRightSideValue(text, 'commission');
      if (rightValue !== undefined) {
        result.commission = rightValue;
      }
    }

    // 5. Cashes: left side = count, right side = value (outgoing amount)
    // Format: x,xxx,xxx.xx (commas as thousands separators)
    const cashesCountMatch = text.match(/\bcashes\b[:\s]*(\d+)/i);
    if (cashesCountMatch) {
      result.cashCount = parseInt(cashesCountMatch[1], 10);
    }
    // Cash value: right side of cashes row - extract digits, remove commas/periods, divide by 100
    const cashesLine = text.split(/\r?\n/).find(line => /\bcashes\b/i.test(line));
    if (cashesLine) {
      const cashValueMatch = cashesLine.match(/\$?([\d,]+\.?\d*)\s*$/);
      if (cashValueMatch) {
        result.cashValue = normalizeAmount(cashValueMatch[1]);
      }
    }

    // 6. Cash bonus
    // Extract digits, remove commas/periods, divide by 100
    const cashBonusMatch = text.match(/(?:cash\s*bonus)[:\s]*\$?([\d,]+\.?\d*)\b/i);
    if (cashBonusMatch) {
      result.cashBonus = normalizeAmount(cashBonusMatch[1]);
    } else {
      const rightValue = extractRightSideValue(text, 'cash\\s*bonus');
      if (rightValue !== undefined) {
        result.cashBonus = rightValue;
      }
    }

    // 7. Claims bonus
    // Extract digits, remove commas/periods, divide by 100
    const claimsBonusMatch = text.match(/(?:claims\s*bonus)[:\s]*\$?([\d,]+\.?\d*)\b/i);
    if (claimsBonusMatch) {
      result.claimsBonus = normalizeAmount(claimsBonusMatch[1]);
    } else {
      const rightValue = extractRightSideValue(text, 'claims\\s*bonus');
      if (rightValue !== undefined) {
        result.claimsBonus = rightValue;
      }
    }

    // 8. Adjustments
    // Extract digits, remove commas/periods, divide by 100
    const adjustmentsMatch = text.match(/(?:adjustments?)[:\s]*\$?([\d,]+\.?\d*)\b/i);
    if (adjustmentsMatch) {
      result.adjustments = normalizeAmount(adjustmentsMatch[1]);
    } else {
      const rightValue = extractRightSideValue(text, 'adjustments?');
      if (rightValue !== undefined) {
        result.adjustments = rightValue;
      }
    }

    // 9. Service fee
    // Extract digits, remove commas/periods, divide by 100
    const serviceFeeMatch = text.match(/(?:service\s*fee)[:\s]*\$?([\d,]+\.?\d*)\b/i);
    if (serviceFeeMatch) {
      result.serviceFee = normalizeAmount(serviceFeeMatch[1]);
    } else {
      const rightValue = extractRightSideValue(text, 'service\\s*fee');
      if (rightValue !== undefined) {
        result.serviceFee = rightValue;
      }
    }

    // 10. Net due: net sales - commission - cashes - cash bonus - claims bonus - adjustments + service fee
    // Extract digits, remove commas/periods, divide by 100
    const netDueMatch = text.match(/(?:net\s*due)[:\s]*\$?([\d,]+\.?\d*)\b/i);
    if (netDueMatch) {
      result.netDue = normalizeAmount(netDueMatch[1]);
    } else {
      const rightValue = extractRightSideValue(text, 'net\\s*due');
      if (rightValue !== undefined) {
        result.netDue = rightValue;
      }
    }
  } else {
    // Default: try to extract common fields (backward compatibility)
    const ticketCountMatch = text.match(/(?:ticket\s*count|count)[:\s]*(\d+)/i);
    if (ticketCountMatch) {
      result.ticketCount = parseInt(ticketCountMatch[1], 10);
    }
    const totalMatch = text.match(/(?:total(?:\s*sales)?)[:\s]*\$?([\d,]+[.,]?\d*)/i);
    if (totalMatch) {
      result.totalSales = normalizeAmount(totalMatch[1]);
    }
    const netDueMatch = text.match(/(?:net\s*due|due)[:\s]*\$?([\d,]+[.,]?\d*)/i);
    if (netDueMatch) {
      result.netDue = normalizeAmount(netDueMatch[1]);
    }
  }

  return result;
}

export function parsePOSReport(text: string): OCRResult {
  const result: OCRResult = {};
  
  // Extract cash amount
  const cashMatch = text.match(/(?:cash)[:\s]*\$?(\d+\.?\d*)/i);
  if (cashMatch) {
    result.cash = parseFloat(cashMatch[1]);
  }

  // Extract card amount
  const cardMatch = text.match(/(?:card|credit)[:\s]*\$?(\d+\.?\d*)/i);
  if (cardMatch) {
    result.card = parseFloat(cardMatch[1]);
  }

  // Extract total (grocery total)
  const totalMatch = text.match(/(?:total|grocery)[:\s]*\$?(\d+\.?\d*)/i);
  if (totalMatch) {
    result.totalSales = parseFloat(totalMatch[1]);
  }

  return result;
}

export async function processLotteryReportImage(
  imageFile: File,
  reportType?: 'instant_34' | 'special_50'
): Promise<OCRResult> {
  const text = await extractTextFromImage(imageFile);
  return parseLotteryReport(text, reportType);
}

export async function processPOSReportImage(imageFile: File): Promise<OCRResult> {
  const text = await extractTextFromImage(imageFile);
  return parsePOSReport(text);
}
