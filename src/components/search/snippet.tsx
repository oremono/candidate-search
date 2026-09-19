/** Resume excerpt with ⟪ ⟫-wrapped matches. Spec: docs/slices/S4-nl-search.md (S4-front). */

export interface SnippetPart {
  text: string;
  match: boolean;
}

/**
 * Split a snippet into plain and matched parts. Text between `⟪` and `⟫` is matched, and each
 * matched word becomes its own part (whitespace between them stays plain). Marker characters
 * never appear in the output, including unpaired ones.
 */
export function parseSnippet(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  const pushPlain = (text: string) => {
    const clean = text.replace(/[⟪⟫]/g, '');
    if (clean === '') return;
    const last = parts[parts.length - 1];
    if (last && !last.match) last.text += clean;
    else parts.push({ text: clean, match: false });
  };

  let cursor = 0;
  for (const m of snippet.matchAll(/⟪([^⟪⟫]*)⟫/g)) {
    pushPlain(snippet.slice(cursor, m.index));
    for (const piece of m[1].split(/(\s+)/)) {
      if (piece === '') continue;
      if (/^\s+$/.test(piece)) pushPlain(piece);
      else parts.push({ text: piece, match: true });
    }
    cursor = m.index + m[0].length;
  }
  pushPlain(snippet.slice(cursor));
  return parts;
}

export function Snippet({ text }: { text: string }): React.ReactElement {
  return (
    <span className="mt-0.5 block text-xs leading-relaxed text-foreground/55">
      {parseSnippet(text).map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="rounded-sm bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-400/30"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  );
}
