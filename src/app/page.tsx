import { count } from 'drizzle-orm';
import { db } from '@/db';
import { candidateTable, educationTable, experienceTable } from '@/db/schema';

// Read from the database on every request rather than at build time.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const [[{ candidates }], [{ education }], [{ experiences }]] = await Promise.all([
    db.select({ candidates: count() }).from(candidateTable),
    db.select({ education: count() }).from(educationTable),
    db.select({ experiences: count() }).from(experienceTable),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Candidate Search</h1>
        <p className="text-foreground/70">
          Starter for the Bolto candidate search challenge. Replace this page with your search
          experience. See <code className="font-mono text-sm">CHALLENGE.md</code> for the brief.
        </p>
      </header>

      <section className="rounded-lg border border-foreground/10 p-5">
        <h2 className="mb-3 text-sm font-medium tracking-wide uppercase text-foreground/60">
          Database
        </h2>
        <dl className="grid grid-cols-3 gap-4 font-mono text-sm">
          <Stat label="candidates" value={candidates} />
          <Stat label="education" value={education} />
          <Stat label="experiences" value={experiences} />
        </dl>
      </section>

      <section className="flex flex-col gap-2 text-sm text-foreground/70">
        <p>
          Try the API stub:{' '}
          <a className="font-mono underline" href="/api/candidates/search?q=react">
            /api/candidates/search?q=react
          </a>
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-foreground/60">{label}</dt>
      <dd className="text-2xl">{value.toLocaleString()}</dd>
    </div>
  );
}
