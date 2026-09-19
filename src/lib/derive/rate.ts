export interface NormalizedRate {
  monthlyRate: number | null;
  rateUnverified: boolean;
}

/** Plausible monthly USD range; anything outside it is treated as unknown. */
const MIN_RATE = 500;
const MAX_RATE = 30000;

/** Keeps a monthly rate only when it falls inside the plausible USD range. */
export function normalizeMonthlyRate(raw: number | null): NormalizedRate {
  if (raw === null || raw < MIN_RATE || raw > MAX_RATE) {
    return { monthlyRate: null, rateUnverified: true };
  }
  return { monthlyRate: raw, rateUnverified: false };
}
