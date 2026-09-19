/** Ranking signals and the combined score for free-text search (S5). */
import { keywordSearch, type KeywordHit } from '@/lib/search/keyword';
import { semanticSearch, type SemanticHit } from '@/lib/search/semantic';

/** Every embedded candidate, so percentiles are over the whole pool. */
const ALL_EMBEDDINGS = 100000;

const WEIGHTS = { semantic: 0.55, keyword: 0.25, skill: 0.2 } as const;

/** A candidate that passed the hard filters, with its raw skill-evidence score. */
export interface SetMember {
  id: number;
  yearsExperience: number;
  skillScore: number;
}

/** Signals for one search; a missing signal is absent from the score. */
export interface Signals {
  /** Present only when effective skills are non-empty. */
  skill: Map<number, number> | null;
  /** Keyword hits by candidate id; present only when the query has keywords. */
  keyword: Map<number, KeywordHit> | null;
  /** Percentile by candidate id; present only when embedding succeeded. */
  semantic: Map<number, number> | null;
}

export interface Ranked {
  id: number;
  score: number;
}

/** Keyword hits within the set, by candidate id; null without keywords. */
export async function keywordSignal(
  keywords: string[],
  ids: number[]
): Promise<Map<number, KeywordHit> | null> {
  if (keywords.length === 0) return null;
  const hits = await keywordSearch(keywords.join(' '), { candidateIds: ids, limit: ids.length });
  return new Map(hits.map((hit) => [hit.candidateId, hit]));
}

/** Similarity percentile of every embedded candidate; null if embedding fails or none exist. */
export async function semanticSignal(
  searchText: string,
  embedQuery: (text: string) => Promise<number[]>
): Promise<Map<number, number> | null> {
  try {
    const vector = await embedQuery(searchText);
    const hits = await semanticSearch(vector, { limit: ALL_EMBEDDINGS });
    return hits.length > 0 ? percentiles(hits) : null;
  } catch {
    return null;
  }
}

/** Fraction of hits whose similarity is ≤ each hit's. `hits` are most similar first. */
function percentiles(hits: SemanticHit[]): Map<number, number> {
  const result = new Map<number, number>();
  let firstOfTie = 0;
  hits.forEach((hit, index) => {
    if (index > 0 && hit.similarity !== hits[index - 1].similarity) firstOfTie = index;
    result.set(hit.candidateId, (hits.length - firstOfTie) / hits.length);
  });
  return result;
}

/** Raw skill scores divided by the set's maximum (all 0 when the maximum is 0). */
export function skillSignal(set: SetMember[], hasSkills: boolean): Map<number, number> | null {
  if (!hasSkills) return null;
  const max = Math.max(0, ...set.map((member) => member.skillScore));
  return new Map(set.map((member) => [member.id, max > 0 ? member.skillScore / max : 0]));
}

/** Weighted mean of the present, normalised signals; 0 when none is present. */
function combinedScore(id: number, signals: Signals, maxKeyword: number): number {
  let total = 0;
  let weight = 0;
  if (signals.semantic) {
    total += WEIGHTS.semantic * (signals.semantic.get(id) ?? 0);
    weight += WEIGHTS.semantic;
  }
  if (signals.keyword) {
    const hit = signals.keyword.get(id);
    total += WEIGHTS.keyword * (hit && maxKeyword > 0 ? hit.score / maxKeyword : 0);
    weight += WEIGHTS.keyword;
  }
  if (signals.skill) {
    total += WEIGHTS.skill * (signals.skill.get(id) ?? 0);
    weight += WEIGHTS.skill;
  }
  return weight > 0 ? total / weight : 0;
}

/** Score the set; best first (score, then years, then id), cut to `limit`. */
export function rank(set: SetMember[], signals: Signals, limit: number): Ranked[] {
  const keywordScores = [...(signals.keyword?.values() ?? [])].map((hit) => hit.score);
  const maxKeyword = Math.max(0, ...keywordScores);
  return set
    .map((member) => ({ member, score: combinedScore(member.id, signals, maxKeyword) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.member.yearsExperience - a.member.yearsExperience ||
        a.member.id - b.member.id
    )
    .slice(0, limit)
    .map(({ member, score }) => ({ id: member.id, score }));
}
