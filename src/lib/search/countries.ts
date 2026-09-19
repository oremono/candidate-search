/** Country names and aliases for free-text queries (spec: docs/slices/S4-nl-search.md). */

/** Countries in the data (minus `-` and `Other`) plus common ones a recruiter might ask for. */
const KNOWN_COUNTRIES = [
  // In the data
  'India',
  'Brazil',
  'Costa Rica',
  'Mexico',
  'Argentina',
  'Venezuela',
  'United States',
  'Chile',
  'Uruguay',
  'Colombia',
  'Peru',
  'United Kingdom',
  'United Arab Emirates',
  'Turkey',
  'Singapore',
  'Qatar',
  'Paraguay',
  'Nigeria',
  'Japan',
  'Germany',
  'China',
  'Belgium',
  // Not in the data, but plausible in a query
  'Canada',
  'Australia',
  'New Zealand',
  'France',
  'Spain',
  'Portugal',
  'Italy',
  'Netherlands',
  'Ireland',
  'Poland',
  'Ukraine',
  'Romania',
  'Sweden',
  'Switzerland',
  'Israel',
  'Pakistan',
  'Bangladesh',
  'Philippines',
  'Vietnam',
  'Indonesia',
  'Egypt',
  'Kenya',
  'South Africa',
];

const ALIASES: Record<string, string> = {
  us: 'United States',
  usa: 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  america: 'United States',
  'united states of america': 'United States',
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
  britain: 'United Kingdom',
  'great britain': 'United Kingdom',
  england: 'United Kingdom',
  uae: 'United Arab Emirates',
  emirates: 'United Arab Emirates',
  brasil: 'Brazil',
  méxico: 'Mexico',
};

/** Aliases that are also everyday words: in free text they only count when written in capitals. */
const CAPITALS_ONLY = ['US', 'USA', 'U.S.', 'U.S.A.'];

/** Lowercase name or alias → canonical country. */
const CANONICAL = new Map<string, string>([
  ...KNOWN_COUNTRIES.map((name) => [name.toLowerCase(), name] as [string, string]),
  ...Object.entries(ALIASES),
]);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word alternation, longest first so "united states of america" beats "america". */
function wholeWords(terms: string[], flags: string): RegExp {
  const alternation = [...terms]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join('|');
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation})(?![\\p{L}\\p{N}])`, `gu${flags}`);
}

const capitalsOnlyLower = new Set(CAPITALS_ONLY.map((term) => term.toLowerCase()));
const ANY_CASE_PATTERN = wholeWords(
  [...CANONICAL.keys()].filter((term) => !capitalsOnlyLower.has(term)),
  'i'
);
const CAPITALS_PATTERN = wholeWords(CAPITALS_ONLY, '');

export interface CountryMatch {
  country: string;
  start: number;
  end: number;
}

/** Canonical country for a name or alias ("usa" → "United States"), or null. */
export function canonicalCountry(name: string): string | null {
  return CANONICAL.get(name.trim().toLowerCase()) ?? null;
}

/** Every country mention in the text with its position, in order, without overlaps. */
export function findCountryMatches(text: string): CountryMatch[] {
  const matches = [ANY_CASE_PATTERN, CAPITALS_PATTERN]
    .flatMap((pattern) => [...text.matchAll(pattern)])
    .map((m) => ({
      country: CANONICAL.get(m[0].toLowerCase())!,
      start: m.index,
      end: m.index + m[0].length,
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: CountryMatch[] = [];
  for (const match of matches) {
    const previous = result.at(-1);
    if (!previous || match.start >= previous.end) result.push(match);
  }
  return result;
}

/** Canonical countries mentioned in free text, in order of first mention, deduplicated. */
export function findCountries(text: string): string[] {
  return [...new Set(findCountryMatches(text).map((match) => match.country))];
}
