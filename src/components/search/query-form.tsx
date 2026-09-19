'use client';

import { useId } from 'react';

/** Free-text search box. Typing only updates the draft; submitting runs the search. */
export function QueryForm({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
}): React.ReactElement {
  const inputId = useId();
  const hintId = useId();

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-1.5"
    >
      <label htmlFor={inputId} className="text-sm font-medium">
        Search candidates
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Senior React engineer in Canada under 130k"
          aria-describedby={hintId}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-foreground/20 bg-background px-3.5 py-2.5 text-base placeholder:text-foreground/40 focus:border-foreground/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Search
        </button>
      </div>
      <p id={hintId} className="text-xs text-foreground/55">
        Describe who you need in plain words; the filters narrow it further.
      </p>
    </form>
  );
}
