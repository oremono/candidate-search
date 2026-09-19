/** Split text into matched / unmatched segments for highlighting. Spec: docs/slices/S6-profile-page.md. */

export interface TextSegment {
  text: string;
  match: boolean;
}

/** Escape regex syntax characters (safe under the `u` flag, unlike escaping `-`). */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/**
 * Case-insensitive, whole-token matching of `terms` in `text`.
 * A match may not touch a letter or digit on either side. When terms overlap at the
 * same position the longest wins. Segments join back to exactly `text`.
 */
export function highlightText(text: string, terms: string[]): TextSegment[] {
  if (text === '') return [];

  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of terms) {
    const term = raw.trim();
    const key = term.toLowerCase();
    if (term === '' || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(term);
  }
  if (cleaned.length === 0) return [{ text, match: false }];

  // Longest first so the alternation prefers `React Native` over `React`.
  cleaned.sort((a, b) => b.length - a.length);
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${cleaned.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`,
    'giu'
  );

  const segments: TextSegment[] = [];
  const pushPlain = (s: string) => {
    if (s === '') return;
    const last = segments[segments.length - 1];
    if (last && !last.match) last.text += s;
    else segments.push({ text: s, match: false });
  };

  let cursor = 0;
  for (const m of text.matchAll(pattern)) {
    const start = m.index;
    if (m[0] === '') continue;
    pushPlain(text.slice(cursor, start));
    segments.push({ text: m[0], match: true });
    cursor = start + m[0].length;
  }
  pushPlain(text.slice(cursor));
  return segments;
}
