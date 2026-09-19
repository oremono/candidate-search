/**
 * Shared API contract between backend and frontend (wave 2+).
 * Owned by the main session. Agents must not change it; ask instead.
 * Dates are ISO `YYYY-MM-DD` strings; money is USD.
 */

// --- search (S3, extended by S4/S5) ---------------------------------------

export interface SearchFilters {
  /** Exact country names, case-insensitive. Empty = any. */
  countries: string[];
  /** Canonical skill names from SKILLS. Candidate must have all of them. */
  skills: string[];
  minYears: number | null;
  maxYears: number | null;
  /** Annual USD, compared against the full-time monthly rate × 12. */
  minSalary: number | null;
  maxSalary: number | null;
}

export interface CandidateSummary {
  id: number;
  name: string;
  country: string;
  yearsExperience: number;
  /** Normalized full-time monthly rate; null when unverified. */
  monthlyRate: number | null;
  rateUnverified: boolean;
  availability: { fullTime: boolean; partTime: boolean; contractor: boolean; employee: boolean };
  biography: string;
  /** Up to 8 skills, strongest evidence first. */
  topSkills: string[];
}

export type MatchReasonKind =
  'skill' | 'experience' | 'salary' | 'country' | 'keyword' | 'semantic';

export interface MatchReason {
  kind: MatchReasonKind;
  /** Short human text, e.g. "React in 3 roles and bio". */
  label: string;
  /** Keyword reasons only: resume excerpt with matched words wrapped in ⟪ ⟫. */
  snippet?: string;
}

export interface SearchResult {
  candidate: CandidateSummary;
  /** Higher is better. Only meaningful within one response. */
  score: number;
  matchedSkills: string[];
  reasons: MatchReason[];
}

// --- natural-language query (S4/S5) ------------------------------------------

export type Seniority = 'junior' | 'mid' | 'senior' | 'lead';

/** What a free-text query was understood to mean. */
export interface ParsedQuery {
  /** Constraints extracted from the text (only these; explicit filters are separate). */
  filters: SearchFilters;
  /** Lowercase terms for resume keyword search that no filter covers, e.g. "fintech". */
  keywords: string[];
  /** The part of the query describing the person (role, stack, domain), for semantic search. */
  searchText: string;
  seniority: Seniority | null;
  source: 'llm' | 'rules';
}

/** A query-derived constraint that was dropped because nothing matched it. */
export interface Relaxation {
  field: keyof SearchFilters;
  message: string;
}

export interface SearchResponse {
  /** Trimmed free-text query, or null when none was given. */
  query: string | null;
  /** How the query was parsed; null without a query. */
  interpretation: ParsedQuery | null;
  /** Query-derived constraints dropped to avoid an empty result, in the order dropped. */
  relaxed: Relaxation[];
  /** Effective filters used: explicit filters merged with parsed ones, after relaxation. */
  filters: SearchFilters;
  /** Candidates matching the filters, before the top-10 cut. */
  total: number;
  /** At most 10. */
  results: SearchResult[];
}

export interface FilterOptions {
  countries: { name: string; count: number }[];
  skills: { name: string; count: number }[];
}

export interface ApiError {
  error: string;
}

// --- profile (S6) ----------------------------------------------------------

export interface ProfileExperience {
  company: string;
  position: string;
  description: string;
  startDate: string | null;
  /** Raw end date from the data; null = open-ended. */
  endDate: string | null;
  /** End after the open-ended rules (S1 resolveJobs); null when not counted. */
  effectiveEndDate: string | null;
  counted: boolean;
  excludedReason: 'intern' | 'non-work' | 'no-start-date' | null;
}

export interface ProfileEducation {
  school: string;
  degree: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ProfileSkill {
  name: string;
  inBio: boolean;
  roleCount: number;
}

export interface CandidateProfile {
  candidate: CandidateSummary;
  partTimeMonthlyRate: number | null;
  /** Newest first; jobs without a start date last. */
  experiences: ProfileExperience[];
  /** Newest first; entries without a start date last. */
  education: ProfileEducation[];
  /** Strongest evidence first. */
  skills: ProfileSkill[];
}
