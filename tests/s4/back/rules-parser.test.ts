import { describe, expect, it } from 'vitest';
import { parseQueryWithRules } from '@/lib/search/rules-parser';

// Spec: docs/slices/S4-nl-search.md, S4-back > Rule-based parser (test list 4–13).

describe('parseQueryWithRules', () => {
  it("4. 'Senior React engineer in Canada under 130k'", () => {
    const r = parseQueryWithRules('Senior React engineer in Canada under 130k');
    expect(r.source).toBe('rules');
    expect(r.filters).toEqual({
      countries: ['Canada'],
      skills: ['React'],
      minYears: 5,
      maxYears: null,
      minSalary: null,
      maxSalary: 130000,
    });
    expect(r.seniority).toBe('senior');
    expect(r.keywords).toEqual([]);
  });

  it("5. 'Rust developer with 5+ years experience in AI/ML'", () => {
    const r = parseQueryWithRules('Rust developer with 5+ years experience in AI/ML');
    expect(r.source).toBe('rules');
    // Domain skills rank, they don't filter: AI / Machine Learning move to keywords.
    expect(r.filters.skills).toEqual(['Rust']);
    expect(r.filters.minYears).toBe(5);
    expect(r.seniority).toBeNull();
    expect(r.keywords).toEqual(['ai', 'machine learning']);
  });

  it("6. 'python data engineer, max $8k/month, Brazil' (monthly ×12)", () => {
    const r = parseQueryWithRules('python data engineer, max $8k/month, Brazil');
    expect(r.source).toBe('rules');
    expect(r.filters.skills).toEqual(['Python']);
    expect(r.filters.countries).toEqual(['Brazil']);
    expect(r.filters.maxSalary).toBe(96000);
    expect(r.keywords).toContain('data');
  });

  it("7. 'backend between 60k and 90k'", () => {
    const r = parseQueryWithRules('backend between 60k and 90k');
    expect(r.source).toBe('rules');
    expect(r.filters.minSalary).toBe(60000);
    expect(r.filters.maxSalary).toBe(90000);
    expect(r.keywords).toEqual(['backend']);
  });

  it("8. 'java 3-6 years'", () => {
    const r = parseQueryWithRules('java 3-6 years');
    expect(r.source).toBe('rules');
    expect(r.filters.minYears).toBe(3);
    expect(r.filters.maxYears).toBe(6);
    expect(r.filters.skills).toEqual(['Java']);
  });

  it("9. 'junior frontend' → junior implies maxYears 3", () => {
    const r = parseQueryWithRules('junior frontend');
    expect(r.source).toBe('rules');
    expect(r.seniority).toBe('junior');
    expect(r.filters.maxYears).toBe(3);
    expect(r.filters.minYears).toBeNull();
    expect(r.keywords).toEqual(['frontend']);
  });

  it("10. 'senior with 2+ years' → explicit years beat seniority", () => {
    const r = parseQueryWithRules('senior with 2+ years');
    expect(r.source).toBe('rules');
    expect(r.filters.minYears).toBe(2);
    expect(r.filters.maxYears).toBeNull();
  });

  it("11. 'fintech payments' → no filters, only keywords", () => {
    const r = parseQueryWithRules('fintech payments');
    expect(r.source).toBe('rules');
    expect(r.filters).toEqual({
      countries: [],
      skills: [],
      minYears: null,
      maxYears: null,
      minSalary: null,
      maxSalary: null,
    });
    expect(r.seniority).toBeNull();
    expect(r.keywords).toEqual(['fintech', 'payments']);
    expect(r.searchText).toBe('fintech payments');
  });

  it("12. 'under 5 years of go' → years, not salary", () => {
    const r = parseQueryWithRules('under 5 years of go');
    expect(r.source).toBe('rules');
    expect(r.filters.maxYears).toBe(5);
    expect(r.filters.maxSalary).toBeNull();
  });

  it("13. '100-130k react' → k on the second number applies to both", () => {
    const r = parseQueryWithRules('100-130k react');
    expect(r.source).toBe('rules');
    expect(r.filters.minSalary).toBe(100000);
    expect(r.filters.maxSalary).toBe(130000);
  });
});

// Spec: docs/slices/S4-nl-search.md, S4-back > Addendum: stack acronyms and LLM field guard (47).
describe('parseQueryWithRules: stack acronyms', () => {
  it("47. 'engineers specialised in MERN stack from india with under 2k per month'", () => {
    const r = parseQueryWithRules(
      'engineers specialised in MERN stack from india with under 2k per month'
    );
    expect(r.source).toBe('rules');
    for (const skill of ['MongoDB', 'Express', 'React', 'Node.js']) {
      expect(r.filters.skills).toContain(skill);
    }
    expect(r.filters.countries).toEqual(['India']);
    expect(r.filters.maxSalary).toBe(24000);
    expect(r.filters.minYears).toBeNull();
    expect(r.filters.maxYears).toBeNull();
    expect(r.seniority).toBeNull();
  });
});
