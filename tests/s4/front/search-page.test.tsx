// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchPage } from '@/components/search/search-page';
import type { SearchFilters, SearchResponse } from '@/lib/contracts';
import { mockFilterOptions, mockNlSearchResponse, mockSearchResponse } from '@/mocks/search';

const initialFilters: SearchFilters = {
  countries: [],
  skills: [],
  minYears: null,
  maxYears: null,
  minSalary: null,
  maxSalary: null,
};

type Fetch = (filters: SearchFilters, q?: string) => Promise<SearchResponse>;

const SUMMARY = '23 candidates match · showing top 2';
const NL_SUMMARY = '64 candidates match · showing top 1';

function setup(fetchResults: ReturnType<typeof vi.fn<Fetch>>, initialQuery?: string) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const props =
    initialQuery === undefined
      ? { options: mockFilterOptions, initialFilters, fetchResults }
      : { options: mockFilterOptions, initialFilters, initialQuery, fetchResults };
  render(<SearchPage {...props} />);
  return { user };
}

function searchBox() {
  return within(screen.getByRole('search')).getByRole('searchbox', {
    name: 'Search candidates',
  });
}

/** Advance the fake clock and flush React updates and pending promises. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SearchPage search form (S4)', () => {
  it('renders a role="search" form with a labelled search input and a Search button', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    setup(fetchResults);
    await screen.findByText(SUMMARY);

    const form = screen.getByRole('search');
    const input = within(form).getByLabelText('Search candidates');
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('placeholder', 'e.g. Senior React engineer in Canada under 130k');
    expect(within(form).getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it("30. with initialQuery 'rust', mount calls fetchResults(initialFilters, 'rust') and the input shows rust", async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    setup(fetchResults, 'rust');
    await screen.findByText(SUMMARY);

    expect(searchBox()).toHaveValue('rust');

    await advance(1000);
    expect(fetchResults).toHaveBeenCalledTimes(1);
    expect(fetchResults).toHaveBeenCalledWith(initialFilters, 'rust');
  });

  it('31. with no initialQuery, mount calls fetchResults with exactly one argument', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    setup(fetchResults);
    await screen.findByText(SUMMARY);

    await advance(1000);
    expect(fetchResults).toHaveBeenCalledTimes(1);
    expect(fetchResults.mock.calls[0].length).toBe(1);
    expect(fetchResults.mock.calls[0][0]).toEqual(initialFilters);
    expect(searchBox()).toHaveValue('');
  });

  it('32. typing in Search candidates without submitting makes no new call, even after 1s', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    const { user } = setup(fetchResults);
    await screen.findByText(SUMMARY);
    expect(fetchResults).toHaveBeenCalledTimes(1);

    await user.type(searchBox(), 'react lead');
    await advance(1000);

    expect(fetchResults).toHaveBeenCalledTimes(1);
  });

  it("33. typing 'react lead' and pressing Enter → one immediate call and ?q=react+lead", async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    const { user } = setup(fetchResults);
    await screen.findByText(SUMMARY);
    expect(fetchResults).toHaveBeenCalledTimes(1);

    await user.type(searchBox(), 'react lead{Enter}');

    // Immediate: no debounce wait needed.
    expect(fetchResults).toHaveBeenCalledTimes(2);
    expect(fetchResults).toHaveBeenLastCalledWith(initialFilters, 'react lead');
    expect(window.location.search).toBe('?q=react+lead');

    await advance(1000);
    expect(fetchResults).toHaveBeenCalledTimes(2);
  });

  it('33b. clicking the Search button submits the trimmed query immediately', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    const { user } = setup(fetchResults);
    await screen.findByText(SUMMARY);

    await user.type(searchBox(), '  react lead  ');
    await user.click(within(screen.getByRole('search')).getByRole('button', { name: 'Search' }));

    expect(fetchResults).toHaveBeenCalledTimes(2);
    expect(fetchResults).toHaveBeenLastCalledWith(initialFilters, 'react lead');
    expect(window.location.search).toBe('?q=react+lead');

    await advance(1000);
    expect(fetchResults).toHaveBeenCalledTimes(2);
  });

  it("34. after submitting 'rust', checking Brazil → one debounced call with countries ['Brazil'] and 'rust'", async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    const { user } = setup(fetchResults);
    await screen.findByText(SUMMARY);

    await user.type(searchBox(), 'rust{Enter}');
    expect(fetchResults).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('checkbox', { name: 'Brazil' }));
    expect(fetchResults).toHaveBeenCalledTimes(2);

    await advance(350);
    expect(fetchResults).toHaveBeenCalledTimes(3);
    expect(fetchResults).toHaveBeenLastCalledWith(
      { ...initialFilters, countries: ['Brazil'] },
      'rust'
    );

    await advance(1000);
    expect(fetchResults).toHaveBeenCalledTimes(3);
  });

  it('34b. filter changes use the last submitted query, not unsubmitted typing', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    const { user } = setup(fetchResults);
    await screen.findByText(SUMMARY);

    await user.type(searchBox(), 'rust{Enter}');
    expect(fetchResults).toHaveBeenCalledTimes(2);

    await user.type(searchBox(), ' and go');
    await user.click(screen.getByRole('checkbox', { name: 'Brazil' }));
    await advance(350);

    expect(fetchResults).toHaveBeenCalledTimes(3);
    expect(fetchResults).toHaveBeenLastCalledWith(
      { ...initialFilters, countries: ['Brazil'] },
      'rust'
    );
  });

  it('34c. with no submitted query, a filter change still calls fetchResults with one argument', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    const { user } = setup(fetchResults);
    await screen.findByText(SUMMARY);

    await user.click(screen.getByRole('checkbox', { name: 'Brazil' }));
    await advance(350);

    expect(fetchResults).toHaveBeenCalledTimes(2);
    expect(fetchResults.mock.calls[1].length).toBe(1);
    expect(fetchResults.mock.calls[1][0]).toEqual({ ...initialFilters, countries: ['Brazil'] });
    expect(window.location.search).toBe('?country=Brazil');
  });

  it('Clear filters clears filters only, not the query', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    const { user } = setup(fetchResults);
    await screen.findByText(SUMMARY);

    await user.type(searchBox(), 'rust{Enter}');
    await user.click(screen.getByRole('checkbox', { name: 'Brazil' }));
    await advance(350);
    expect(fetchResults).toHaveBeenCalledTimes(3);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await advance(350);

    expect(fetchResults).toHaveBeenCalledTimes(4);
    expect(fetchResults).toHaveBeenLastCalledWith(initialFilters, 'rust');
    expect(searchBox()).toHaveValue('rust');
  });
});

describe('SearchPage interpretation and relaxation (S4)', () => {
  it('35. mockNlSearchResponse → Interpreted as chips in order, and "Read by AI"', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockNlSearchResponse);
    setup(fetchResults, 'Senior React engineer in Canada under 130k, fintech');
    await screen.findByText(NL_SUMMARY);

    const list = screen.getByRole('list', { name: 'Interpreted as' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.trim())).toEqual([
      'React',
      'Canada',
      '5+ yrs',
      '≤ $130,000/yr',
      'Senior',
      '“fintech”',
    ]);
    expect(screen.getByText('Read by AI')).toBeInTheDocument();
    expect(screen.queryByText('Read by keyword rules')).not.toBeInTheDocument();
  });

  it('35b. a rules interpretation shows "Read by keyword rules"', async () => {
    const rules: SearchResponse = {
      ...mockNlSearchResponse,
      interpretation: { ...mockNlSearchResponse.interpretation!, source: 'rules' },
    };
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(rules);
    setup(fetchResults, 'Senior React engineer in Canada under 130k, fintech');
    await screen.findByText(NL_SUMMARY);

    expect(screen.getByText('Read by keyword rules')).toBeInTheDocument();
    expect(screen.queryByText('Read by AI')).not.toBeInTheDocument();
  });

  it('36. mockNlSearchResponse → role="note" contains the relaxation message', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockNlSearchResponse);
    setup(fetchResults, 'Senior React engineer in Canada under 130k, fintech');
    await screen.findByText(NL_SUMMARY);

    expect(screen.getByRole('note')).toHaveTextContent(
      'No candidates in Canada match, so country was ignored.'
    );
  });

  it('37. mockSearchResponse → no Interpreted as list and no role="note"', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    setup(fetchResults);
    await screen.findByText(SUMMARY);

    expect(screen.queryByRole('list', { name: 'Interpreted as' })).not.toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
