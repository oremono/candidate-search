// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, buildSearchQuery } from '@/lib/search-query';
import { mockSearchResponse } from '@/mocks/search';

describe('buildSearchQuery with q (S4)', () => {
  it('29a. trimmed q goes first as q=...', () => {
    expect(buildSearchQuery(EMPTY_FILTERS, ' rust dev ')).toBe('q=rust+dev');
  });

  it('29b. q comes before the S3 filter params', () => {
    expect(buildSearchQuery(mockSearchResponse.filters, 'x')).toBe(
      'q=x&country=Brazil&skill=React&minYears=5&maxSalary=120000'
    );
  });

  it('29c. a whitespace-only q is left out', () => {
    expect(buildSearchQuery(EMPTY_FILTERS, '  ')).toBe('');
  });

  it('29d. without q the output is unchanged from S3', () => {
    expect(buildSearchQuery(mockSearchResponse.filters)).toBe(
      'country=Brazil&skill=React&minYears=5&maxSalary=120000'
    );
  });
});
