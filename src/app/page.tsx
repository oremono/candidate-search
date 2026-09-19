import { SearchApp } from '@/components/search/search-app';
import { getFilterOptions } from '@/lib/search/filter-search';
import { parseSearchParams } from '@/lib/search/params';
import { EMPTY_FILTERS } from '@/lib/search-query';

// Read from the database on every request rather than at build time.
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : [value ?? '']) params.append(key, v);
  }
  // An invalid shared link falls back to no filters rather than an error page.
  const parsed = parseSearchParams(params);
  const options = await getFilterOptions();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Candidate search</h1>
        <p className="text-sm text-foreground/70">
          Filter 1,000 experienced software engineers by country, skills, experience and salary.
        </p>
      </header>
      <SearchApp options={options} initialFilters={parsed.ok ? parsed.filters : EMPTY_FILTERS} />
    </main>
  );
}
