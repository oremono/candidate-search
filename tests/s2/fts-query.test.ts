import { describe, expect, it } from 'vitest';
import { toFtsQuery } from '@/lib/search/keyword';

describe('toFtsQuery', () => {
  it(`7. 'Rust' → '"rust"'`, () => {
    expect(toFtsQuery('Rust')).toBe('"rust"');
  });

  it(`8. 'AI/ML engineer' → '"ai" OR "ml" OR "engineer"'`, () => {
    expect(toFtsQuery('AI/ML engineer')).toBe('"ai" OR "ml" OR "engineer"');
  });

  it(`9. 'C++ and C#' → '"c++" OR "and" OR "c#"'`, () => {
    expect(toFtsQuery('C++ and C#')).toBe('"c++" OR "and" OR "c#"');
  });

  it(`10. 'node.js.' → '"node.js"'`, () => {
    expect(toFtsQuery('node.js.')).toBe('"node.js"');
  });

  it(`11. 'NOT rust' → '"not" OR "rust"' (FTS operators become plain words)`, () => {
    expect(toFtsQuery('NOT rust')).toBe('"not" OR "rust"');
  });

  it(`12. 'rust Rust RUST' → '"rust"' (deduplicated)`, () => {
    expect(toFtsQuery('rust Rust RUST')).toBe('"rust"');
  });

  it.each(['', '   ', 'a', '"; --'])('13. %j → null', (input) => {
    expect(toFtsQuery(input)).toBeNull();
  });
});
