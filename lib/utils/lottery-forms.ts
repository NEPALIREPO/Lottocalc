/** Shared lottery report form state derived from API data (admin + staff) */

export interface Instant34Form {
  totalCashes: string;
}

export interface Special50Form {
  totalSales: string;
  seasonTkts: string;
  discount: string;
  cancels: string;
  freeBets: string;
  commission: string;
  cashes: string;
  cashBonus: string;
  claimBonus: string;
  adjustments: string;
  serviceFee: string;
}

type ReportRow = {
  report_type?: string;
  instant_total?: number | null;
  total_sales?: number | null;
  season_tkts?: number | null;
  discount?: number | null;
  cancels?: number | null;
  free_bets?: number | null;
  commission?: number | null;
  cash_value?: number | null;
  cash_bonus?: number | null;
  claims_bonus?: number | null;
  adjustments?: number | null;
  service_fee?: number | null;
};

const emptySpecial50: Special50Form = {
  totalSales: '',
  seasonTkts: '',
  discount: '',
  cancels: '',
  freeBets: '',
  commission: '',
  cashes: '',
  cashBonus: '',
  claimBonus: '',
  adjustments: '',
  serviceFee: '',
};

/** Map getLotteryReports(date) result to instant34 + special50 form state */
export function mapLotteryReportsToForms(reports: ReportRow[] | null): {
  instant34Form: Instant34Form;
  special50Form: Special50Form;
} {
  const r34 = reports?.find((r) => r.report_type === 'instant_34');
  const r50 = reports?.find((r) => r.report_type === 'special_50');
  return {
    instant34Form: {
      totalCashes: r34?.instant_total != null ? String(r34.instant_total) : '',
    },
    special50Form: {
      ...emptySpecial50,
      totalSales: r50?.total_sales != null ? String(r50.total_sales) : '',
      seasonTkts: r50?.season_tkts != null ? String(r50.season_tkts) : '',
      discount: r50?.discount != null ? String(r50.discount) : '',
      cancels: r50?.cancels != null ? String(r50.cancels) : '',
      freeBets: r50?.free_bets != null ? String(r50.free_bets) : '',
      commission: r50?.commission != null ? String(r50.commission) : '',
      cashes: r50?.cash_value != null ? String(r50.cash_value) : '',
      cashBonus: r50?.cash_bonus != null ? String(r50.cash_bonus) : '',
      claimBonus: r50?.claims_bonus != null ? String(r50.claims_bonus) : '',
      adjustments: r50?.adjustments != null ? String(r50.adjustments) : '',
      serviceFee: r50?.service_fee != null ? String(r50.service_fee) : '',
    },
  };
}
