import Link from 'next/link';
import type {
  CandidateProfile,
  ProfileEducation,
  ProfileExperience,
  ProfileSkill,
} from '@/lib/contracts';
import { formatDateRange, formatMonthlyRate, formatYears } from '@/lib/format';
import { HighlightedText } from './highlighted-text';
import {
  chipClass,
  emptyClass,
  markChipClass,
  sectionClass,
  sectionHeadingClass,
  tagClass,
} from './styles';

const EXCLUDED_LABEL: Record<NonNullable<ProfileExperience['excludedReason']>, string> = {
  intern: 'Not counted: internship',
  'non-work': 'Not counted: non-work',
  'no-start-date': 'Not counted: no start date',
};

const AVAILABILITY: { key: keyof CandidateProfile['candidate']['availability']; label: string }[] =
  [
    { key: 'fullTime', label: 'Full-time' },
    { key: 'partTime', label: 'Part-time' },
    { key: 'contractor', label: 'Contractor' },
    { key: 'employee', label: 'Employee' },
  ];

/** Candidate profile. Pure render: no hooks or data fetching, so it works on server or client. */
export function ProfileView({
  profile,
  highlight,
}: {
  profile: CandidateProfile;
  highlight: string[];
}): React.ReactElement {
  const { candidate, partTimeMonthlyRate, experiences, education, skills } = profile;
  const fullTimeRate = formatMonthlyRate(candidate.rateUnverified ? null : candidate.monthlyRate);
  const partTimeRate = formatMonthlyRate(partTimeMonthlyRate);
  const tags = AVAILABILITY.filter((a) => candidate.availability[a.key]);
  const highlighted = new Set(highlight.map((h) => h.trim().toLowerCase()).filter((h) => h !== ''));

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 sm:px-6 md:py-10">
      <nav>
        <Link
          href="/"
          className="text-sm text-foreground/70 underline-offset-4 before:mr-1 before:content-['←'] hover:text-foreground hover:underline focus:outline-none focus-visible:underline"
        >
          Back to search
        </Link>
      </nav>

      <header className="flex flex-col gap-4 border-b border-foreground/10 pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{candidate.name}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-foreground/70">
            <span>{candidate.country}</span>
            <span aria-hidden="true" className="text-foreground/30">
              ·
            </span>
            <span>{formatYears(candidate.yearsExperience)}</span>
          </p>
        </div>

        <dl className="flex flex-wrap gap-3">
          <RateItem
            label="Full-time"
            value={fullTimeRate}
            unverified={candidate.rateUnverified || candidate.monthlyRate === null}
          />
          <RateItem
            label="Part-time"
            value={partTimeRate}
            unverified={partTimeMonthlyRate === null}
          />
        </dl>

        {tags.length > 0 && (
          <ul aria-label="Availability" className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <li key={t.key} className={tagClass}>
                {t.label}
              </li>
            ))}
          </ul>
        )}
      </header>

      <Section title="About">
        {candidate.biography.trim() === '' ? (
          <p className={emptyClass}>None listed</p>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/85 sm:text-base">
            <HighlightedText text={candidate.biography} terms={highlight} />
          </p>
        )}
      </Section>

      <Section title="Experience">
        {experiences.length === 0 ? (
          <p className={emptyClass}>None listed</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {experiences.map((exp, i) => (
              <ExperienceItem key={i} exp={exp} highlight={highlight} />
            ))}
          </ol>
        )}
      </Section>

      <Section title="Education">
        {education.length === 0 ? (
          <p className={emptyClass}>None listed</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {education.map((ed, i) => (
              <EducationItem key={i} ed={ed} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Skills">
        {skills.length === 0 ? (
          <p className={emptyClass}>None listed</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <li key={skill.name}>
                {highlighted.has(skill.name.toLowerCase()) ? (
                  <mark className={markChipClass}>
                    <span>{skillLabel(skill)}</span>
                  </mark>
                ) : (
                  <span className={chipClass}>{skillLabel(skill)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </article>
  );
}

function skillLabel(skill: ProfileSkill): string {
  const roles = `${skill.roleCount} ${skill.roleCount === 1 ? 'role' : 'roles'}`;
  return `${skill.name} · ${roles}${skill.inBio ? ' · bio' : ''}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={sectionClass}>
      <h2 className={sectionHeadingClass}>{title}</h2>
      {children}
    </section>
  );
}

function RateItem({
  label,
  value,
  unverified,
}: {
  label: string;
  value: string;
  unverified: boolean;
}) {
  return (
    <div className="flex min-w-32 flex-col gap-0.5 rounded-lg border border-foreground/10 px-3 py-2">
      <dt className="text-xs font-medium tracking-wide text-foreground/60 uppercase">{label}</dt>
      <dd
        className={
          unverified ? 'text-sm italic text-foreground/50' : 'text-base font-semibold tabular-nums'
        }
      >
        {value}
      </dd>
    </div>
  );
}

function ExperienceItem({ exp, highlight }: { exp: ProfileExperience; highlight: string[] }) {
  const badge = exp.counted
    ? null
    : exp.excludedReason
      ? EXCLUDED_LABEL[exp.excludedReason]
      : 'Not counted';
  return (
    <li
      className={
        'flex flex-col gap-1 border-l-2 pl-4 ' +
        (exp.counted ? 'border-foreground/20' : 'border-dashed border-foreground/10')
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-medium">
          {exp.position}
          {exp.company && <span className="font-normal text-foreground/70"> · {exp.company}</span>}
        </h3>
        <span className="text-sm text-foreground/60 tabular-nums">
          {formatDateRange(exp.startDate, exp.endDate)}
        </span>
      </div>
      {badge && (
        <span className="self-start rounded-full border border-foreground/15 bg-foreground/5 px-2 py-0.5 text-xs text-foreground/70">
          {badge}
        </span>
      )}
      {exp.description.trim() !== '' && (
        <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/80">
          <HighlightedText text={exp.description} terms={highlight} />
        </p>
      )}
    </li>
  );
}

function EducationItem({ ed }: { ed: ProfileEducation }) {
  const degree = ed.degree.trim();
  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-base font-medium">
          {degree !== '' ? (
            <>
              {degree}
              <span className="font-normal text-foreground/70"> · {ed.school}</span>
            </>
          ) : (
            ed.school
          )}
        </p>
        <span className="text-sm text-foreground/60 tabular-nums">
          {formatDateRange(ed.startDate, ed.endDate)}
        </span>
      </div>
    </li>
  );
}
