/** Display helpers shared by search and profile UI. Spec: docs/slices/S3-filter-search.md. */

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const monthYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** 5000 → "$5,000/mo"; null → "Rate unverified". */
export function formatMonthlyRate(rate: number | null): string {
  return rate === null ? 'Rate unverified' : `${usd.format(rate)}/mo`;
}

/** 6.7 → "6.7 yrs"; 1 → "1 yr"; 0 → "0 yrs". */
export function formatYears(years: number): string {
  return `${years} ${years === 1 ? 'yr' : 'yrs'}`;
}

/** ("2020-01-01", null) → "Jan 2020 – Present"; (null, …) → "Unknown start – …". */
export function formatDateRange(start: string | null, end: string | null): string {
  const from = start ? monthYear.format(new Date(start)) : 'Unknown start';
  const to = end ? monthYear.format(new Date(end)) : 'Present';
  return `${from} – ${to}`;
}
