// Ringkasan kelayakan untuk pengajuan pembiayaan: murni dari catatan keuangan organisasi. BUKAN penilaian kredit.
export interface MonthFlow { month: string; income: number; expense: number }
export interface Eligibility {
  months: number; monthsWithData: number; income: number; expense: number; profit: number; marginPct: number | null;
  avgMonthlyProfit: number | null; profitableMonths: number; activeBatches: number; openReceivables: number;
  dataQuality: "cukup" | "kurang";
  notes: string[];
}

export function summarizeEligibility(series: MonthFlow[], activeBatches: number, openReceivables: number): Eligibility {
  const withData = series.filter((m) => m.income > 0 || m.expense > 0);
  const income = series.reduce((s, m) => s + m.income, 0);
  const expense = series.reduce((s, m) => s + m.expense, 0);
  const profit = income - expense;
  const profitable = series.filter((m) => m.income - m.expense > 0).length;
  const notes: string[] = [];
  const quality = withData.length >= 3 ? "cukup" : "kurang";
  if (quality === "kurang") notes.push("Catatan keuangan baru ada di kurang dari 3 bulan; mitra biasanya meminta riwayat lebih panjang.");
  if (income === 0) notes.push("Belum ada pemasukan tercatat.");
  if (profit < 0) notes.push("Pengeluaran lebih besar dari pemasukan pada periode ini.");
  if (activeBatches === 0) notes.push("Tidak ada batch aktif.");
  return {
    months: series.length, monthsWithData: withData.length, income, expense, profit,
    marginPct: income > 0 ? Math.round((profit / income) * 1000) / 10 : null,
    avgMonthlyProfit: withData.length ? Math.round(profit / withData.length) : null,
    profitableMonths: profitable, activeBatches, openReceivables, dataQuality: quality, notes,
  };
}
