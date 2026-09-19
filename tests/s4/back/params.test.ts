import { describe, expect, it } from 'vitest';
import { parseQueryParam } from '@/lib/search/params';

// Spec: docs/slices/S4-nl-search.md, S4-back > API contract (parseQueryParam).
// Not a numbered case; encodes the contract comment "trimmed `q`, '' when absent".

describe('parseQueryParam', () => {
  it('returns q trimmed', () => {
    expect(parseQueryParam(new URLSearchParams('q=%20%20rust%20dev%20'))).toBe('rust dev');
  });

  it("returns '' when q is absent or blank", () => {
    expect(parseQueryParam(new URLSearchParams('skill=React'))).toBe('');
    expect(parseQueryParam(new URLSearchParams('q=%20%20'))).toBe('');
  });
});
