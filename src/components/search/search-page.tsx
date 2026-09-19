'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { FilterOptions, SearchFilters, SearchResponse } from '@/lib/contracts';
import { buildSearchQuery, EMPTY_FILTERS } from '@/lib/search-query';
import { FilterPanel } from './filter-panel';
import { Interpretation, RelaxationNote } from './interpretation';
import { ResultCard } from './result-card';
import { QueryForm } from './query-form';
import { buttonClass } from './styles';

const DEBOUNCE_MS = 300;

export function SearchPage({
  options,
  initialFilters,
  initialQuery = '',
  fetchResults,
}: {
  options: FilterOptions;
  initialFilters: SearchFilters;
  initialQuery?: string;
  fetchResults: (filters: SearchFilters, q?: string) => Promise<SearchResponse>;
}): React.ReactElement {
  const [filters, setFilters] = useState(initialFilters);
  // What's in the box vs. what was last submitted; only the latter drives fetches.
  const [draft, setDraft] = useState(initialQuery);
  const submittedQuery = useRef(initialQuery.trim());
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The mount fetch starts straight away, so we begin in the pending state.
  const [pending, setPending] = useState(true);

  const filtersHeadingId = useId();
  const resultsHeadingId = useId();
  const latestRequest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRef = useRef(fetchResults);
  const initialRef = useRef(initialFilters);

  useEffect(() => {
    fetchRef.current = fetchResults;
  }, [fetchResults]);

  /**
   * Fire a request; only the newest request's outcome is applied. Without a query the fetcher
   * gets exactly one argument, as in S3.
   */
  function request(next: SearchFilters, q: string) {
    const id = ++latestRequest.current;
    const call = q === '' ? fetchRef.current(next) : fetchRef.current(next, q);
    call.then(
      (res) => {
        if (id !== latestRequest.current) return;
        setResponse(res);
        setError(null);
        setPending(false);
      },
      (err: unknown) => {
        if (id !== latestRequest.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setPending(false);
      }
    );
  }

  // Mount: exactly one immediate fetch for the initial filters, no debounce.
  useEffect(() => {
    request(initialRef.current, submittedQuery.current);
    const requests = latestRequest;
    const pendingTimer = timer;
    return () => {
      // Invalidate in-flight requests and drop any scheduled one.
      requests.current++;
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, []);

  function handleChange(next: SearchFilters) {
    setFilters(next);
    window.history.replaceState(null, '', '?' + buildSearchQuery(next, submittedQuery.current));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setPending(true);
      request(next, submittedQuery.current);
    }, DEBOUNCE_MS);
  }

  /** Submitting fetches right away with the current filters; it supersedes any pending debounce. */
  function handleSubmit() {
    const q = draft.trim();
    submittedQuery.current = q;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    window.history.replaceState(null, '', '?' + buildSearchQuery(filters, q));
    setPending(true);
    request(filters, q);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 md:gap-8 md:py-10">
      <QueryForm value={draft} onChange={setDraft} onSubmit={handleSubmit} />

      <div className="grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)]">
        <aside
          aria-labelledby={filtersHeadingId}
          className="md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] md:self-start md:overflow-y-auto md:pr-2"
        >
          <h2 id={filtersHeadingId} className="mb-4 text-lg font-semibold tracking-tight">
            Filters
          </h2>
          <FilterPanel options={options} value={filters} onChange={handleChange} />
        </aside>

        <section aria-labelledby={resultsHeadingId} className="flex min-w-0 flex-col gap-4">
          <h2 id={resultsHeadingId} className="sr-only">
            Results
          </h2>

          <div role="status" aria-live="polite" className="min-h-5 text-sm text-foreground/60">
            {pending ? 'Searching…' : ''}
          </div>

          {error === null && response?.interpretation ? (
            <Interpretation parsed={response.interpretation} />
          ) : null}
          {error === null && response && response.relaxed.length > 0 ? (
            <RelaxationNote relaxed={response.relaxed} />
          ) : null}

          {error !== null ? (
            <div
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          ) : response === null ? null : response.total === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-foreground/15 p-6">
              <p className="text-sm text-foreground/80">No candidates match these filters.</p>
              <button
                type="button"
                onClick={() => handleChange(EMPTY_FILTERS)}
                className={buttonClass}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div
              aria-busy={pending}
              className={`flex flex-col gap-4 transition-opacity ${pending ? 'opacity-60' : ''}`}
            >
              <p className="text-sm text-foreground/70">
                {`${response.total} ${response.total === 1 ? 'candidate matches' : 'candidates match'} · showing top ${response.results.length}`}
              </p>
              <ol className="flex flex-col gap-3">
                {response.results.map((result) => (
                  <li key={result.candidate.id}>
                    <ResultCard result={result} />
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
