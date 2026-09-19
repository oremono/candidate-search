// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultCard } from '@/components/search/result-card';
import { mockSearchResponse } from '@/mocks/search';

const [ana, bruno] = mockSearchResponse.results;

describe('ResultCard', () => {
  it('31. name links to /candidates/101?highlight=React; shows years, rate and 4 reasons', () => {
    const { container } = render(<ResultCard result={ana} />);

    const link = screen.getByRole('link', { name: 'Ana Souza' });
    expect(link).toHaveAttribute('href', '/candidates/101?highlight=React');

    expect(container.textContent).toContain('Brazil');
    expect(container.textContent).toContain('7.4 yrs');
    expect(container.textContent).toContain('$6,000/mo');

    const reasons = screen.getByRole('list', { name: 'Why matched' });
    const items = within(reasons).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.map((li) => li.textContent?.trim())).toEqual(ana.reasons.map((r) => r.label));
  });

  it('32. an unverified rate shows "Rate unverified"', () => {
    const { container } = render(<ResultCard result={bruno} />);
    expect(container.textContent).toContain('Rate unverified');
  });

  it('33. the matched React chip is inside a <mark>; TypeScript is not', () => {
    render(<ResultCard result={ana} />);

    const react = screen.getAllByText('React');
    expect(react.some((el) => el.closest('mark') !== null)).toBe(true);

    const typescript = screen.getAllByText('TypeScript');
    expect(typescript.length).toBeGreaterThan(0);
    for (const el of typescript) expect(el.closest('mark')).toBeNull();
  });
});
