/**
 * Rule-based query parser, used without an OpenAI key or when the LLM fails
 * (spec: docs/slices/S4-nl-search.md, "Rule-based parser").
 *
 * Pipeline: years → salary (on the text with year phrases masked) → seniority → countries
 * → skills → keywords → searchText → normalizeParsed.
 */
import type { ParsedQuery, Seniority } from '@/lib/contracts';
import { extractSkills } from '@/lib/derive/skills';
import { findCountryMatches } from './countries';
import { normalizeParsed } from './query-parser';

interface Span {
  start: number;
  end: number;
}

type Bounds = { min: number | null; max: number | null };

/** Not glued to a letter or digit on the left / right. */
const L = String.raw`(?<![\p{L}\p{N}])`;
const R = String.raw`(?![\p{L}\p{N}])`;
const re = (source: string) => new RegExp(source, 'giu');

// --- years ------------------------------------------------------------------

const YEAR_UNIT = String.raw`(?:years?|yrs?|yoe)${R}`;
const YEAR_NUM = String.raw`${L}(\d+(?:\.\d+)?)`;

/** Tried in order; the first match for each bound wins. */
const YEAR_RULES: { pattern: RegExp; read: (m: RegExpMatchArray) => Partial<Bounds> }[] = [
  {
    // "3-6 years", "3 to 6 yrs"
    pattern: re(String.raw`${YEAR_NUM}\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*${YEAR_UNIT}`),
    read: (m) => ({ min: Number(m[1]), max: Number(m[2]) }),
  },
  {
    // "under 5 years", "at most 5 yrs"
    pattern: re(
      String.raw`${L}(?:under|less than|up to|at most|max(?:imum)?)\s+(\d+(?:\.\d+)?)\s*${YEAR_UNIT}`
    ),
    read: (m) => ({ max: Number(m[1]) }),
  },
  {
    // "at least 5 years", "over 5+ yrs"
    pattern: re(
      String.raw`${L}(?:at least|more than|over|min(?:imum)?)\s+(\d+(?:\.\d+)?)\s*\+?\s*${YEAR_UNIT}`
    ),
    read: (m) => ({ min: Number(m[1]) }),
  },
  {
    // "5+ years", "5 yoe"
    pattern: re(String.raw`${YEAR_NUM}\s*\+?\s*${YEAR_UNIT}`),
    read: (m) => ({ min: Number(m[1]) }),
  },
];

// --- salary -----------------------------------------------------------------

/** An amount like `$130,000`, `130k` or `8.5k`, captured as `<name>` and `<name>K`. */
const money = (name: string) =>
  String.raw`\$?\s?${L}(?<${name}>\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?<${name}K>\s?k${R})?`;
const MONTHLY = String.raw`(?<monthly>\s*(?:\/\s*mo(?:nth)?|per\s+month|a\s+month|monthly)${R})?`;
const MAX_WORDS = String.raw`(?:${L}(?:under|below|less than|max(?:imum)?|up to|at most)\s+|(?:<=|≤|<)\s*)`;
const MIN_WORDS = String.raw`(?:${L}(?:over|above|more than|min(?:imum)?|at least)\s+|(?:>=|≥|>)\s*)`;

const SALARY_RULES: { pattern: RegExp; bounds: 'range' | 'max' | 'min' }[] = [
  {
    pattern: re(String.raw`${L}between\s+${money('a')}\s+and\s+${money('b')}${MONTHLY}`),
    bounds: 'range',
  },
  {
    pattern: re(String.raw`${money('a')}\s*(?:-|–|to)\s*${money('b')}${MONTHLY}`),
    bounds: 'range',
  },
  { pattern: re(`${MAX_WORDS}${money('a')}${MONTHLY}`), bounds: 'max' },
  { pattern: re(`${MIN_WORDS}${money('a')}${MONTHLY}`), bounds: 'min' },
];

/** Annual USD amounts from a salary match, or null if a number is too small to be a salary. */
function readSalary(groups: Record<string, string | undefined>): number[] | null {
  const names = groups.b === undefined ? ['a'] : ['a', 'b'];
  // "100-130k": a `k` on the second number applies to both.
  const sharedK = groups.bK !== undefined;
  const amounts: number[] = [];
  for (const name of names) {
    const hasK = groups[`${name}K`] !== undefined || sharedK;
    const value = Number(groups[name]!.replace(/,/g, ''));
    if (!hasK && value < 1000) return null;
    const annual = (hasK ? value * 1000 : value) * (groups.monthly ? 12 : 1);
    amounts.push(annual);
  }
  return amounts;
}

// --- seniority --------------------------------------------------------------

const SENIORITY_RULES: [Seniority, RegExp][] = [
  ['junior', re(`${L}(?:junior|jr)${R}`)],
  ['mid', re(`${L}(?:mid-level|mid|intermediate)${R}`)],
  ['senior', re(`${L}(?:senior|sr)${R}`)],
  ['lead', re(`${L}(?:lead|staff|principal)${R}`)],
];

// --- keywords ---------------------------------------------------------------

const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}+#.]*/gu;
const NUMBER_TOKEN = /^\d+(?:[.,]\d+)*[k+]?$/i;
const STOPWORDS = new Set(
  `a an and the in of for with to at on or who has have having is are be from based plus strong
  good great solid experience experienced exp engineer engineers developer developers dev devs
  candidate candidates someone looking need needs want wants role position job knowledge
  background skills skilled working work worked expert expertise years year yrs yr yoe`.split(/\s+/)
);

interface Token extends Span {
  text: string; // original case, trailing dots stripped
}

function tokenize(q: string): Token[] {
  return [...q.matchAll(TOKEN_PATTERN)].map((m) => {
    const text = m[0].replace(/\.+$/, '');
    return { text, start: m.index, end: m.index + text.length };
  });
}

/**
 * Indexes of tokens that name a skill: on their own (in original case), or as part of a
 * multi-word skill like "machine learning" (a run of 2–4 tokens that is minimal: dropping
 * either end loses the skill).
 */
function skillTokenIndexes(q: string, tokens: Token[]): Set<number> {
  // Include a leading dot so ".NET" is seen as a skill.
  const textOf = (i: number, j: number) =>
    q.slice(q[tokens[i].start - 1] === '.' ? tokens[i].start - 1 : tokens[i].start, tokens[j].end);
  const skillsIn = (i: number, j: number) => new Set(extractSkills(textOf(i, j)));

  const indexes = new Set<number>();
  tokens.forEach((_, i) => {
    if (skillsIn(i, i).size > 0) indexes.add(i);
  });
  for (let size = 2; size <= 4; size++) {
    for (let i = 0; i + size <= tokens.length; i++) {
      const j = i + size - 1;
      const withoutFirst = skillsIn(i + 1, j);
      const withoutLast = skillsIn(i, j - 1);
      const minimal = [...skillsIn(i, j)].some(
        (skill) => !withoutFirst.has(skill) && !withoutLast.has(skill)
      );
      if (minimal) for (let k = i; k <= j; k++) indexes.add(k);
    }
  }
  return indexes;
}

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

function extractKeywords(q: string, consumed: Span[]): string[] {
  const tokens = tokenize(q);
  const skillTokens = skillTokenIndexes(q, tokens);
  const keywords = tokens
    .filter((token, i) => !skillTokens.has(i) && !consumed.some((span) => overlaps(span, token)))
    .map((token) => token.text.toLowerCase())
    .filter((word) => word.length >= 2 && !NUMBER_TOKEN.test(word) && !STOPWORDS.has(word));
  return [...new Set(keywords)];
}

// --- searchText -------------------------------------------------------------

const EDGE_CONNECTOR =
  /^(?:based\s+in|in|with|under|from)(?=\s|$)|(?:^|\s)(?:based\s+in|in|with|under|from)$/i;
const EDGE_PUNCTUATION = /^[\s,;:!?/|&\-–—]+|[\s,;:!?/|&\-–—]+$/g;

/** The query minus salary, years and country phrases, with dangling connectors trimmed. */
function buildSearchText(q: string, removed: Span[]): string {
  let text = q;
  for (const span of [...removed].sort((a, b) => b.start - a.start)) {
    text = text.slice(0, span.start) + ' ' + text.slice(span.end);
  }
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\s*([,;])(?:\s*[,;])+/g, '$1')
    .replace(/\s+([,;])/g, '$1');

  let previous;
  do {
    previous = text;
    text = text.replace(EDGE_PUNCTUATION, '').replace(EDGE_CONNECTOR, '').trim();
  } while (text !== previous);
  return text || q;
}

// --- pipeline ---------------------------------------------------------------

/** Runs each rule over the text, filling bounds first-come and recording matched spans. */
function applyRules<T>(
  text: string,
  rules: T[],
  patternOf: (rule: T) => RegExp,
  apply: (rule: T, m: RegExpMatchArray) => boolean
): Span[] {
  const spans: Span[] = [];
  for (const rule of rules) {
    for (const m of text.matchAll(patternOf(rule))) {
      const span = { start: m.index!, end: m.index! + m[0].length };
      if (spans.some((s) => overlaps(s, span))) continue;
      if (apply(rule, m)) spans.push(span);
    }
  }
  return spans;
}

const mask = (text: string, spans: Span[]) =>
  spans.reduce(
    (out, { start, end }) => out.slice(0, start) + ' '.repeat(end - start) + out.slice(end),
    text
  );

function setBounds(target: Bounds, found: Partial<Bounds>) {
  if (found.min !== undefined && target.min === null) target.min = found.min;
  if (found.max !== undefined && target.max === null) target.max = found.max;
}

export function parseQueryWithRules(q: string): ParsedQuery {
  const query = q.trim();

  // 1–2. Years first, so "under 5 years" is never read as a salary.
  const years: Bounds = { min: null, max: null };
  const yearSpans = applyRules(
    query,
    YEAR_RULES,
    (rule) => rule.pattern,
    (rule, m) => {
      setBounds(years, rule.read(m));
      return true;
    }
  );

  const salary: Bounds = { min: null, max: null };
  const salarySpans = applyRules(
    mask(query, yearSpans),
    SALARY_RULES,
    (rule) => rule.pattern,
    (rule, m) => {
      const amounts = readSalary(m.groups ?? {});
      if (!amounts) return false;
      if (rule.bounds === 'range') setBounds(salary, { min: amounts[0], max: amounts[1] });
      else setBounds(salary, { [rule.bounds]: amounts[0] });
      return true;
    }
  );

  // 3. Seniority: the earliest word in the query.
  const seniorityHits = SENIORITY_RULES.flatMap(([level, pattern]) =>
    [...query.matchAll(pattern)].map((m) => ({
      level,
      start: m.index,
      end: m.index + m[0].length,
    }))
  ).sort((a, b) => a.start - b.start);

  // 4. Countries.
  const countryMatches = findCountryMatches(query);

  const phraseSpans = [...yearSpans, ...salarySpans, ...countryMatches];
  return normalizeParsed(
    {
      skills: extractSkills(query), // 5.
      countries: [...new Set(countryMatches.map((match) => match.country))],
      minYears: years.min,
      maxYears: years.max,
      minSalary: salary.min,
      maxSalary: salary.max,
      seniority: seniorityHits[0]?.level ?? null,
      keywords: extractKeywords(query, [...phraseSpans, ...seniorityHits]), // 6.
      searchText: buildSearchText(query, phraseSpans), // 7.
    },
    'rules'
  );
}
