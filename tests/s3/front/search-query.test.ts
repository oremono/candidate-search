// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, buildSearchQuery } from '@/lib/search-query';
import { mockSearchResponse } from '@/mocks/search';

describe('buildSearchQuery', () => {
  it('23. EMPTY_FILTERS → ""', () => {
    expect(buildSearchQuery(EMPTY_FILTERS)).toBe('');
  });

  it('24. mockSearchResponse.filters → params in order, nulls and empty arrays left out', () => {
    expect(buildSearchQuery(mockSearchResponse.filters)).toBe(
      'country=Brazil&skill=React&minYears=5&maxSalary=120000'
    );
  });

  it('25. values are URL-encoded like URLSearchParams', () => {
    expect(
      buildSearchQuery({ ...EMPTY_FILTERS, countries: ['Costa Rica'], skills: ['C++', 'C#'] })
    ).toBe('country=Costa+Rica&skill=C%2B%2B&skill=C%23');
  });
});
