import { highlightText } from '@/lib/highlight';
import { markClass } from './styles';

/** Renders text with each matched term in its own `<mark>`. */
export function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightText(text, terms).map((seg, i) =>
        seg.match ? (
          <mark key={i} className={markClass}>
            {seg.text}
          </mark>
        ) : (
          seg.text
        )
      )}
    </>
  );
}
