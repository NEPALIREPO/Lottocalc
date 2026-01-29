'use server';

import { calculateWeeklySummary, calculateDailySummary } from '@/lib/calculations';
import { DailySummary } from '@/lib/calculations';

export async function getWeeklySummary(startDate: Date): Promise<DailySummary[]> {
  return await calculateWeeklySummary(startDate);
}

export async function getDateRangeSummary(startDate: Date, endDate: Date): Promise<DailySummary> {
  const summaries: DailySummary[] = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    const summary = await calculateDailySummary(new Date(currentDate));
    summaries.push(summary);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Aggregate all summaries into a single summary
  const aggregated: DailySummary = {
    date: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    scratchSales: summaries.reduce((sum, s) => sum + s.scratchSales, 0),
    onlineSales: summaries.reduce((sum, s) => sum + s.onlineSales, 0),
    grocerySales: summaries.reduce((sum, s) => sum + s.grocerySales, 0),
    lotteryCashes: summaries.reduce((sum, s) => sum + s.lotteryCashes, 0),
    playerBalance: summaries.reduce((sum, s) => sum + s.playerBalance, 0),
    expectedCash: summaries.reduce((sum, s) => sum + s.expectedCash, 0),
  };

  return aggregated;
}
