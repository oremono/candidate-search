// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultCard } from '@/components/search/result-card';
import { mockNlSearchResponse } from '@/mocks/search';

const result = mockNlSearchResponse.results[0];

describe('ResultCard snippets (S4)', () => {
  it('38. the keyword snippet puts fintech in a <mark>, with no ⟪ or ⟫ shown', () => {
    const { container } = render(<ResultCard result={result} />);

    const marks = Array.from(container.querySelectorAll('mark'));
    expect(marks.some((m) => m.textContent === 'fintech')).toBe(true);

    expect(container.textContent).not.toContain('⟪');
    expect(container.textContent).not.toContain('⟫');
  });

  it("38b. the snippet is shown in the keyword reason's list item, with its label", () => {
    render(<ResultCard result={result} />);
    const reasons = screen.getByRole('list', { name: 'Why matched' });

    const fintechMark = Array.from(reasons.querySelectorAll('mark')).find(
      (m) => m.textContent === 'fintech'
    );
    expect(fintechMark).toBeDefined();

    const item = fintechMark!.closest('li');
    expect(item).not.toBeNull();
    const text = item!.textContent ?? '';
    expect(text).toContain('Resume mentions fintech');
    expect(text).toContain('React and TypeScript design systems for');
    expect(text).toContain('products');
    // The label comes before the snippet.
    expect(text.indexOf('Resume mentions fintech')).toBeLessThan(
      text.indexOf('React and TypeScript design systems for')
    );
  });
});
