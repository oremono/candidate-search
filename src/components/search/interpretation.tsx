/** How a free-text query was read, and which constraints were relaxed. Spec: docs/slices/S4-nl-search.md. */
import type { ParsedQuery, Relaxation } from '@/lib/contracts';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function range(min: number | null, max: number | null, fmt: (n: number) => string, unit: string) {
  if (min !== null && max !== null) return `${fmt(min)}–${fmt(max)}${unit}`;
  if (min !== null) return `${fmt(min)}+${unit}`;
  if (max !== null) return `≤ ${fmt(max)}${unit}`;
  return null;
}

/** Chip texts in display order: skills, countries, years, salary, seniority, keywords. */
export function interpretationChips(parsed: ParsedQuery): string[] {
  const { filters } = parsed;
  const chips = [...filters.skills, ...filters.countries];

  const years = range(filters.minYears, filters.maxYears, String, ' yrs');
  if (years) chips.push(years);

  const { minSalary, maxSalary } = filters;
  if (minSalary !== null && maxSalary !== null) {
    chips.push(`${usd.format(minSalary)}–${usd.format(maxSalary)}/yr`);
  } else if (minSalary !== null) {
    chips.push(`≥ ${usd.format(minSalary)}/yr`);
  } else if (maxSalary !== null) {
    chips.push(`≤ ${usd.format(maxSalary)}/yr`);
  }

  if (parsed.seniority) {
    chips.push(parsed.seniority[0].toUpperCase() + parsed.seniority.slice(1));
  }
  for (const keyword of parsed.keywords) chips.push(`“${keyword}”`);
  return chips;
}

export function Interpretation({ parsed }: { parsed: ParsedQuery }): React.ReactElement {
  const chips = interpretationChips(parsed);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span aria-hidden="true" className="text-xs text-foreground/50">
          Interpreted as
        </span>
        <ul aria-label="Interpreted as" className="flex flex-wrap gap-1.5">
          {chips.map((chip, i) => (
            <li
              key={`${chip}-${i}`}
              className="rounded-full border border-dashed border-sky-600/40 px-2 py-0.5 text-xs text-sky-800 dark:border-sky-400/40 dark:text-sky-200"
            >
              {chip}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[11px] text-foreground/45">
        {parsed.source === 'llm' ? 'Read by AI' : 'Read by keyword rules'}
      </p>
    </div>
  );
}

export function RelaxationNote({ relaxed }: { relaxed: Relaxation[] }): React.ReactElement {
  return (
    <div
      role="note"
      className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200"
    >
      {relaxed.map((r, i) => (
        <p key={`${r.field}-${i}`}>{r.message}</p>
      ))}
    </div>
  );
}
