// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterPanel } from '@/components/search/filter-panel';
import type { SearchFilters } from '@/lib/contracts';
import { EMPTY_FILTERS } from '@/lib/search-query';
import { mockFilterOptions } from '@/mocks/search';

/** Non-empty fields elsewhere, so "other fields unchanged" is observable. */
const base: SearchFilters = {
  countries: [],
  skills: ['React'],
  minYears: null,
  maxYears: 8,
  minSalary: 50000,
  maxSalary: null,
};

/** Controlled render with a fixed value; the panel is not expected to update it itself. */
function setup(value: SearchFilters) {
  const onChange = vi.fn<(next: SearchFilters) => void>();
  const user = userEvent.setup();
  const view = render(
    <FilterPanel options={mockFilterOptions} value={value} onChange={onChange} />
  );
  return { onChange, user, view };
}

describe('FilterPanel', () => {
  it('26. checking Brazil calls onChange with countries ["Brazil"], other fields unchanged', async () => {
    const { onChange, user } = setup(base);
    await user.click(screen.getByRole('checkbox', { name: 'Brazil' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ ...base, countries: ['Brazil'] });
  });

  it('27. with countries ["Brazil"], unchecking Brazil calls onChange with countries []', async () => {
    const { onChange, user } = setup({ ...base, countries: ['Brazil'] });
    const brazil = screen.getByRole('checkbox', { name: 'Brazil' });
    expect(brazil).toBeChecked();
    await user.click(brazil);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ ...base, countries: [] });
  });

  it('28. typing "ru" in Filter skills keeps Rust visible and hides Python and React', async () => {
    const { user } = setup({ ...base, skills: [] });
    await user.type(screen.getByLabelText('Filter skills'), 'ru');
    expect(screen.getByRole('checkbox', { name: 'Rust' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Python' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'React' })).not.toBeInTheDocument();
  });

  it('29a. typing 5 in Min years calls onChange with minYears 5', async () => {
    const { onChange, user } = setup(base);
    await user.type(screen.getByLabelText('Min years'), '5');
    expect(onChange).toHaveBeenLastCalledWith({ ...base, minYears: 5 });
  });

  it('29b. clearing Min years calls onChange with minYears null', async () => {
    const withFive = { ...base, minYears: 5 };
    const { onChange, user } = setup(withFive);
    const input = screen.getByLabelText('Min years');
    expect(input).toHaveValue(5);
    await user.clear(input);
    expect(onChange).toHaveBeenLastCalledWith({ ...base, minYears: null });
  });

  it('30. Clear filters calls onChange with EMPTY_FILTERS', async () => {
    const { onChange, user } = setup({ ...base, countries: ['India'] });
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onChange).toHaveBeenLastCalledWith(EMPTY_FILTERS);
  });
});
