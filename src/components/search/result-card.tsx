'use client';

import type { SearchResult } from '@/lib/contracts';
import { formatMonthlyRate, formatYears } from '@/lib/format';

export function ResultCard({ result }: { result: SearchResult }): React.ReactElement {
  const { candidate, matchedSkills, reasons } = result;
  const matched = new Set(matchedSkills.map((s) => s.toLowerCase()));
  const href =
    `/candidates/${candidate.id}` +
    (matchedSkills.length > 0 ? `?highlight=${encodeURIComponent(matchedSkills.join(','))}` : '');
  const rate = formatMonthlyRate(candidate.rateUnverified ? null : candidate.monthlyRate);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-foreground/10 p-4 sm:p-5">
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">
          <a
            href={href}
            className="underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
          >
            {candidate.name}
          </a>
        </h3>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-foreground/70">
          <span>{candidate.country}</span>
          <span aria-hidden="true" className="text-foreground/30">
            ·
          </span>
          <span>{formatYears(candidate.yearsExperience)}</span>
          <span aria-hidden="true" className="text-foreground/30">
            ·
          </span>
          <span className={candidate.rateUnverified ? 'italic text-foreground/50' : undefined}>
            {rate}
          </span>
        </p>
      </header>

      {candidate.biography && (
        <p className="line-clamp-2 text-sm text-foreground/70">{candidate.biography}</p>
      )}

      {candidate.topSkills.length > 0 && (
        <ul aria-label="Top skills" className="flex flex-wrap gap-1.5">
          {candidate.topSkills.map((skill) => (
            <li
              key={skill}
              className="rounded-full border border-foreground/10 px-2 py-0.5 text-xs text-foreground/80"
            >
              {matched.has(skill.toLowerCase()) ? (
                <mark className="rounded-sm bg-amber-200/70 px-0.5 font-medium text-foreground dark:bg-amber-400/30">
                  {skill}
                </mark>
              ) : (
                skill
              )}
            </li>
          ))}
        </ul>
      )}

      {reasons.length > 0 && (
        <ul
          aria-label="Why matched"
          className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-foreground/80 marker:text-foreground/30"
        >
          {reasons.map((reason, i) => (
            <li key={`${reason.kind}-${i}`}>{reason.label}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
