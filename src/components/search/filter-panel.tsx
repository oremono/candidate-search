'use client';

import { useId, useState } from 'react';
import type { FilterOptions, SearchFilters } from '@/lib/contracts';
import { EMPTY_FILTERS } from '@/lib/search-query';
import { buttonClass, inputClass, legendClass } from './styles';

type ListKey = 'countries' | 'skills';
type NumberKey = 'minYears' | 'maxYears' | 'minSalary' | 'maxSalary';

function hasValue(list: string[], name: string): boolean {
  const lower = name.toLowerCase();
  return list.some((v) => v.toLowerCase() === lower);
}

export function FilterPanel({
  options,
  value,
  onChange,
}: {
  options: FilterOptions;
  value: SearchFilters;
  onChange: (next: SearchFilters) => void;
}): React.ReactElement {
  const [skillQuery, setSkillQuery] = useState('');
  const skillFilterId = useId();

  function toggle(key: ListKey, name: string, checked: boolean) {
    const current = value[key];
    const lower = name.toLowerCase();
    const next = checked
      ? hasValue(current, name)
        ? current
        : [...current, name]
      : current.filter((v) => v.toLowerCase() !== lower);
    onChange({ ...value, [key]: next });
  }

  function setNumber(key: NumberKey, n: number | null) {
    onChange({ ...value, [key]: n });
  }

  const query = skillQuery.trim().toLowerCase();
  const visibleSkills = options.skills.filter(
    (s) => !query || s.name.toLowerCase().includes(query) || hasValue(value.skills, s.name)
  );

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className={legendClass}>Country</legend>
        <OptionList
          items={options.countries}
          selected={value.countries}
          onToggle={(name, checked) => toggle('countries', name, checked)}
        />
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={skillFilterId} className="sr-only">
          Filter skills
        </label>
        <input
          id={skillFilterId}
          type="text"
          value={skillQuery}
          onChange={(e) => setSkillQuery(e.target.value)}
          placeholder="Filter skills…"
          autoComplete="off"
          className={`${inputClass} w-full`}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className={legendClass}>Skills</legend>
          <OptionList
            items={visibleSkills}
            selected={value.skills}
            onToggle={(name, checked) => toggle('skills', name, checked)}
          />
          {visibleSkills.length === 0 && (
            <p className="text-sm text-foreground/60">No skills match.</p>
          )}
        </fieldset>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={legendClass}>Experience</legend>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Min years"
            value={value.minYears}
            onChange={(n) => setNumber('minYears', n)}
            step="0.5"
          />
          <NumberField
            label="Max years"
            value={value.maxYears}
            onChange={(n) => setNumber('maxYears', n)}
            step="0.5"
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={legendClass}>Salary</legend>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Min salary (USD/yr)"
            value={value.minSalary}
            onChange={(n) => setNumber('minSalary', n)}
            step="1000"
          />
          <NumberField
            label="Max salary (USD/yr)"
            value={value.maxSalary}
            onChange={(n) => setNumber('maxSalary', n)}
            step="1000"
          />
        </div>
      </fieldset>

      <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className={buttonClass}>
        Clear filters
      </button>
    </div>
  );
}

function OptionList({
  items,
  selected,
  onToggle,
}: {
  items: { name: string; count: number }[];
  selected: string[];
  onToggle: (name: string, checked: boolean) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto pr-1">
      {items.map((item) => (
        <li
          key={item.name}
          className="flex items-center justify-between gap-3 rounded px-1 py-0.5 hover:bg-foreground/5"
        >
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hasValue(selected, item.name)}
              onChange={(e) => onToggle(item.name, e.target.checked)}
              className="size-4 shrink-0 accent-foreground"
            />
            <span className="truncate">{item.name}</span>
          </label>
          <span aria-hidden="true" className="shrink-0 text-xs tabular-nums text-foreground/50">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

function parseNumber(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  step: string;
}) {
  const id = useId();
  // Keep the typed text locally so partial input ("5.") isn't wiped by the controlled value,
  // and re-sync when the value changes from outside (e.g. Clear filters).
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (parseNumber(draft) !== value) setDraft(value === null ? '' : String(value));
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs text-foreground/70">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(parseNumber(e.target.value));
        }}
        className={`${inputClass} w-full min-w-0 tabular-nums`}
      />
    </div>
  );
}
