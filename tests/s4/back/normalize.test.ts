import { describe, expect, it } from 'vitest';
import { normalizeParsed, type RawParsedQuery } from '@/lib/search/query-parser';

// Spec: docs/slices/S4-nl-search.md, S4-back > normalizeParsed (test list 14–18).

function raw(overrides: Partial<RawParsedQuery> = {}): RawParsedQuery {
  return {
    skills: [],
    countries: [],
    minYears: null,
    maxYears: null,
    minSalary: null,
    maxSalary: null,
    seniority: null,
    keywords: [],
    searchText: 'test query',
    ...overrides,
  };
}

describe('normalizeParsed', () => {
  it("14. skills ['reactjs', 'Kubernetes', 'fintech'] → ['React', 'Kubernetes'], fintech to keywords", () => {
    const r = normalizeParsed(raw({ skills: ['reactjs', 'Kubernetes', 'fintech'] }), 'llm');
    expect(r.source).toBe('llm');
    expect(r.filters.skills).toEqual(['React', 'Kubernetes']);
    expect(r.keywords).toContain('fintech');
  });

  it("15. countries ['usa', 'atlantis'] → ['United States', 'Atlantis']", () => {
    const r = normalizeParsed(raw({ countries: ['usa', 'atlantis'] }), 'llm');
    expect(r.filters.countries).toEqual(['United States', 'Atlantis']);
  });

  it('16. min > max salary is swapped; negative years → null', () => {
    const r = normalizeParsed(raw({ minSalary: 150000, maxSalary: 90000, minYears: -1 }), 'llm');
    expect(r.filters.minSalary).toBe(90000);
    expect(r.filters.maxSalary).toBe(150000);
    expect(r.filters.minYears).toBeNull();
  });

  it("17. seniority 'lead' sets minYears 8 only when no years are given", () => {
    const noYears = normalizeParsed(raw({ seniority: 'lead' }), 'llm');
    expect(noYears.filters.minYears).toBe(8);

    const withMax = normalizeParsed(raw({ seniority: 'lead', maxYears: 4 }), 'llm');
    expect(withMax.filters.minYears).toBeNull();
    expect(withMax.filters.maxYears).toBe(4);
  });

  it('18. keywords are lowercased, deduplicated, emptied and stripped of chosen skills', () => {
    const r = normalizeParsed(
      raw({ skills: ['React'], keywords: ['React', 'fintech', 'Fintech', ' '] }),
      'llm'
    );
    expect(r.keywords).toEqual(['fintech']);
  });
});
