import { describe, expect, it } from 'vitest';
import { normalizeMonthlyRate } from '@/lib/derive/rate';

describe('normalizeMonthlyRate', () => {
  it.each([null, 0, 1, 499, 30001, 17065389])('15. %s → unusable { null, true }', (raw) => {
    expect(normalizeMonthlyRate(raw)).toEqual({ monthlyRate: null, rateUnverified: true });
  });

  it.each([500, 5000, 30000])('16. %s → kept as-is, verified', (raw) => {
    expect(normalizeMonthlyRate(raw)).toEqual({ monthlyRate: raw, rateUnverified: false });
  });
});
