// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { formatDateRange, formatMonthlyRate, formatYears } from '@/lib/format';

describe('format helpers', () => {
  it('20. formatMonthlyRate: 5000 → "$5,000/mo"; null → "Rate unverified"', () => {
    expect(formatMonthlyRate(5000)).toBe('$5,000/mo');
    expect(formatMonthlyRate(null)).toBe('Rate unverified');
  });

  it('21. formatYears: 6.7 → "6.7 yrs"; 1 → "1 yr"; 0 → "0 yrs"', () => {
    expect(formatYears(6.7)).toBe('6.7 yrs');
    expect(formatYears(1)).toBe('1 yr');
    expect(formatYears(0)).toBe('0 yrs');
  });

  it('22. formatDateRange: open end → "Present"; missing start → "Unknown start"', () => {
    expect(formatDateRange('2020-01-01', null)).toBe('Jan 2020 – Present');
    expect(formatDateRange(null, '2021-06-30')).toBe('Unknown start – Jun 2021');
  });
});
