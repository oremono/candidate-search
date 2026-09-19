// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { highlightText, type TextSegment } from '@/lib/highlight';

function join(segments: TextSegment[]): string {
  return segments.map((s) => s.text).join('');
}

describe('highlightText', () => {
  it('9. overlapping terms: the longest wins, matching is case-insensitive', () => {
    expect(highlightText('I love react and React Native', ['React', 'React Native'])).toEqual([
      { text: 'I love ', match: false },
      { text: 'react', match: true },
      { text: ' and ', match: false },
      { text: 'React Native', match: true },
    ]);
  });

  it('10. terms with regex characters (C++, C#) are both matched', () => {
    const segments = highlightText('Built C++ and C# tools', ['C++', 'C#']);
    expect(segments).toEqual([
      { text: 'Built ', match: false },
      { text: 'C++', match: true },
      { text: ' and ', match: false },
      { text: 'C#', match: true },
      { text: ' tools', match: false },
    ]);
  });

  it('11. a term glued to a neighbouring letter does not match', () => {
    expect(highlightText('reactive systems', ['React'])).toEqual([
      { text: 'reactive systems', match: false },
    ]);
  });

  it("12. no terms → one non-match segment; '' input → []", () => {
    expect(highlightText('abc', [])).toEqual([{ text: 'abc', match: false }]);
    expect(highlightText('', ['x'])).toEqual([]);
  });

  it('13. joining segment texts returns the input; no empty segments; non-matches merged', () => {
    const cases: [string, string[]][] = [
      ['I love react and React Native', ['React', 'React Native']],
      ['Built C++ and C# tools with .NET', ['C++', 'C#', '.NET']],
      ['reactive systems', ['React']],
      ['Rust, rust and RUST!', ['rust']],
      ['Nothing to see here', ['Go', '', '   ']],
      ['abc', []],
    ];
    for (const [text, terms] of cases) {
      const segments = highlightText(text, terms);
      expect(join(segments)).toBe(text);
      for (const s of segments) expect(s.text).not.toBe('');
      for (let i = 1; i < segments.length; i++) {
        expect(segments[i - 1].match || segments[i].match).toBe(true);
      }
    }
  });
});
