import { describe, expect, it } from 'vitest';
import { parseSearchParams } from '@/lib/search/params';

// Spec: docs/slices/S3-filter-search.md, S3-back > parseSearchParams (test list 1–7).

function parse(query: string) {
  return parseSearchParams(new URLSearchParams(query));
}

function expectOk(query: string) {
  const result = parse(query);
  if (!result.ok) throw new Error(`expected ok for "${query}", got error "${result.error}"`);
  return result.filters;
}

function expectError(query: string) {
  const result = parse(query);
  if (result.ok) throw new Error(`expected an error for "${query}", got ok`);
  return result.error;
}

describe('parseSearchParams', () => {
  it("1. '' → ok, with every filter empty or null", () => {
    expect(expectOk('')).toEqual({
      countries: [],
      skills: [],
      minYears: null,
      maxYears: null,
      minSalary: null,
      maxSalary: null,
    });
  });

  it('2. countries are trimmed, deduplicated case-insensitively, first spelling kept', () => {
    const filters = expectOk('country=Brazil&country=brazil&country=%20India%20');
    expect(filters.countries).toEqual(['Brazil', 'India']);
  });

  it('3. skills are matched case-insensitively and returned in canonical form', () => {
    const filters = expectOk('skill=react&skill=PYTHON');
    expect(filters.skills).toEqual(['React', 'Python']);
  });

  it("4. skill=Cobol → error 'Unknown skill: Cobol'", () => {
    expect(expectError('skill=Cobol')).toBe('Unknown skill: Cobol');
  });

  it("5. minYears=abc → 'Invalid minYears'; maxSalary=-1 → 'Invalid maxSalary'", () => {
    expect(expectError('minYears=abc')).toBe('Invalid minYears');
    expect(expectError('maxSalary=-1')).toBe('Invalid maxSalary');
  });

  it("6. minYears=10&maxYears=5 → 'minYears is greater than maxYears'", () => {
    expect(expectError('minYears=10&maxYears=5')).toBe('minYears is greater than maxYears');
  });

  it('7. minYears=&maxSalary=120000 → minYears null, maxSalary 120000', () => {
    const filters = expectOk('minYears=&maxSalary=120000');
    expect(filters.minYears).toBeNull();
    expect(filters.maxSalary).toBe(120000);
  });
});
