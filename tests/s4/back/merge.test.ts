import { describe, expect, it } from 'vitest';
import type { SearchFilters } from '@/lib/contracts';
import { mergeFilters } from '@/lib/search/merge';

// Spec: docs/slices/S4-nl-search.md, S4-back > mergeFilters (test list 24–25).

const EMPTY: SearchFilters = {
  countries: [],
  skills: [],
  minYears: null,
  maxYears: null,
  minSalary: null,
  maxSalary: null,
};

describe('mergeFilters', () => {
  it('24. explicit countries win; parsed maxSalary fills the gap', () => {
    const { filters, fromQuery } = mergeFilters(
      { ...EMPTY, countries: ['Brazil'] },
      { ...EMPTY, countries: ['Canada'], maxSalary: 130000 }
    );
    expect(filters).toEqual({ ...EMPTY, countries: ['Brazil'], maxSalary: 130000 });
    expect(fromQuery).toEqual(['maxSalary']);
  });

  it('25. empty explicit filters take everything parsed, in SearchFilters field order', () => {
    const { filters, fromQuery } = mergeFilters(EMPTY, {
      ...EMPTY,
      skills: ['React'],
      minYears: 5,
    });
    expect(filters).toEqual({ ...EMPTY, skills: ['React'], minYears: 5 });
    expect(fromQuery).toEqual(['skills', 'minYears']);
  });
});
