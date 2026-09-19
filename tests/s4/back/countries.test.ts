import { describe, expect, it } from 'vitest';
import { canonicalCountry, findCountries } from '@/lib/search/countries';

// Spec: docs/slices/S4-nl-search.md, S4-back > Countries (test list 1–3).

describe('canonicalCountry', () => {
  it("1. maps names and aliases case-insensitively; unknown and 'Other' → null", () => {
    expect(canonicalCountry('usa')).toBe('United States');
    expect(canonicalCountry('Brasil')).toBe('Brazil');
    expect(canonicalCountry('canada')).toBe('Canada');
    expect(canonicalCountry('Atlantis')).toBeNull();
    expect(canonicalCountry('Other')).toBeNull();
  });
});

describe('findCountries', () => {
  it("2. 'React dev in Canada or the UK' → ['Canada', 'United Kingdom']", () => {
    expect(findCountries('React dev in Canada or the UK')).toEqual(['Canada', 'United Kingdom']);
  });

  it("3. whole words only, and lowercase 'us' is ignored", () => {
    expect(findCountries('Indiana plus us')).toEqual([]);
    expect(findCountries('based in the US')).toEqual(['United States']);
  });
});
