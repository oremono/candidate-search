export interface JobInput {
  company: string;
  position: string;
  startDate: Date | null;
  endDate: Date | null;
}

export interface ResolvedJob extends JobInput {
  /** true if the job counts toward years of experience */
  counted: boolean;
  /** why it was not counted; null when counted */
  excludedReason: 'intern' | 'non-work' | 'no-start-date' | null;
  /** end date after applying the open-ended rules; null when not counted */
  effectiveEndDate: Date | null;
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365.25;
const INTERN = /(?<![a-z0-9])(?:intern|interns|internship)(?![a-z0-9])/i;
const NON_WORK =
  /career break|career transition|career gap|sabbatical|trainee|student|volunteer|teaching assistant/i;

/** Whole UTC days since the epoch. */
const utcDay = (date: Date) => Math.floor(date.getTime() / MS_PER_DAY);

/** First matching exclusion rule for a job, or null when it counts. */
function exclusion(job: JobInput): ResolvedJob['excludedReason'] {
  const text = `${job.position}\n${job.company}`;
  if (INTERN.test(text)) return 'intern';
  if (NON_WORK.test(text)) return 'non-work';
  if (job.startDate === null) return 'no-start-date';
  return null;
}

/** Marks which jobs count and where each counted job effectively ends. Same order as the input. */
export function resolveJobs(jobs: JobInput[], today: Date): ResolvedJob[] {
  const reasons = jobs.map(exclusion);
  const openStarts = jobs
    .filter((job, i) => reasons[i] === null && job.endDate === null)
    .map((job) => job.startDate!);

  return jobs.map((job, i) => {
    const excludedReason = reasons[i];
    if (excludedReason !== null) {
      return { ...job, counted: false, excludedReason, effectiveEndDate: null };
    }

    let effectiveEndDate: Date;
    if (job.endDate !== null) {
      effectiveEndDate = utcDay(job.endDate) > utcDay(today) ? today : job.endDate;
    } else {
      // Ends at the next strictly later open-ended start, or today.
      const start = utcDay(job.startDate!);
      const next = openStarts
        .filter((date) => utcDay(date) > start)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      effectiveEndDate = next ?? today;
    }
    return { ...job, counted: true, excludedReason: null, effectiveEndDate };
  });
}

/** Years with overlaps merged, rounded to 1 decimal. */
export function yearsOfExperience(jobs: JobInput[], today: Date): number {
  const periods = resolveJobs(jobs, today)
    .filter((job) => job.counted)
    .map((job) => [utcDay(job.startDate!), utcDay(job.effectiveEndDate!)])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  // Merge overlapping or touching periods and add up their days.
  let days = 0;
  let current: number[] | null = null;
  for (const [start, end] of periods) {
    if (current && start <= current[1]) {
      current[1] = Math.max(current[1], end);
    } else {
      if (current) days += current[1] - current[0];
      current = [start, end];
    }
  }
  if (current) days += current[1] - current[0];

  return Math.round((days / DAYS_PER_YEAR) * 10) / 10;
}
