// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchPage } from '@/components/search/search-page';
import type { SearchFilters, SearchResponse } from '@/lib/contracts';
import { buildSearchQuery } from '@/lib/search-query';
import { mockEmptySearchResponse, mockFilterOptions, mockSearchResponse } from '@/mocks/search';

const initialFilters: SearchFilters = {
  countries: [],
  skills: [],
  minYears: null,
  maxYears: null,
  minSalary: null,
  maxSalary: null,
};

type Fetch = (filters: SearchFilters) => Promise<SearchResponse>;

function setup(fetchResults: ReturnType<typeof vi.fn<Fetch>>) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <SearchPage
      options={mockFilterOptions}
      initialFilters={initialFilters}
      fetchResults={fetchResults}
    />
  );
  return { user };
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

describe('SearchPage', () => {
  it('34. on mount calls fetchResults once with initialFilters, then shows the summary and names', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    setup(fetchResults);

    expect(await screen.findByText('23 candidates match · showing top 2')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument();

    await advance(1000);
    expect(fetchResults).toHaveBeenCalledTimes(1);
    expect(fetchResults).toHaveBeenCalledWith(initialFilters);
  });

  it('35. two quick filter changes within 300 ms → one more call, with the latest filters', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    const { user } = setup(fetchResults);
    await screen.findByText('23 candidates match · showing top 2');
    expect(fetchResults).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('checkbox', { name: 'Brazil' }));
    await user.click(screen.getByRole('checkbox', { name: 'India' }));
    expect(fetchResults).toHaveBeenCalledTimes(1);

    await advance(350);
    expect(fetchResults).toHaveBeenCalledTimes(2);
    expect(fetchResults).toHaveBeenLastCalledWith({
      ...initialFilters,
      countries: ['Brazil', 'India'],
    });

    await advance(1000);
    expect(fetchResults).toHaveBeenCalledTimes(2);
  });

  it("36. after a change, window.location.search is '?' + buildSearchQuery(latest)", async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockSearchResponse);
    const { user } = setup(fetchResults);
    await screen.findByText('23 candidates match · showing top 2');

    await user.click(screen.getByRole('checkbox', { name: 'Brazil' }));
    await advance(350);

    const latest = { ...initialFilters, countries: ['Brazil'] };
    expect(window.location.search).toBe('?' + buildSearchQuery(latest));
    expect(window.location.search).toBe('?country=Brazil');
  });

  it('37. an empty response shows "No candidates match these filters."', async () => {
    const fetchResults = vi.fn<Fetch>().mockResolvedValue(mockEmptySearchResponse);
    setup(fetchResults);
    expect(await screen.findByText('No candidates match these filters.')).toBeInTheDocument();
  });

  it('38. a rejected fetch shows role="alert" containing the error message', async () => {
    const fetchResults = vi.fn<Fetch>().mockRejectedValue(new Error('boom'));
    setup(fetchResults);
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });

  it('39. shows "Searching…" in role="status" while a request is pending', async () => {
    let resolve: (value: SearchResponse) => void = () => {};
    const pending = new Promise<SearchResponse>((r) => {
      resolve = r;
    });
    const fetchResults = vi.fn<Fetch>().mockReturnValue(pending);
    setup(fetchResults);

    expect(await screen.findByRole('status')).toHaveTextContent('Searching…');

    await act(async () => {
      resolve(mockSearchResponse);
    });
    await waitFor(() => expect(screen.queryByText('Searching…')).not.toBeInTheDocument());
    expect(screen.getByText('23 candidates match · showing top 2')).toBeInTheDocument();
  });
});
