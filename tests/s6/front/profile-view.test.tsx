// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileView } from '@/components/profile/profile-view';
import type { CandidateProfile } from '@/lib/contracts';
import { mockProfile } from '@/mocks/profile';

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** The section belonging to an h2: its nearest <section>, else the heading's parent. */
function sectionFor(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 2, name });
  const section = heading.closest('section') ?? heading.parentElement;
  if (!section) throw new Error(`no container for h2 "${name}"`);
  return section as HTMLElement;
}

/** Elements under `root` whose whole (whitespace-normalized) text equals `text`. */
function elementsWithText(root: HTMLElement, text: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('*')).filter(
    (el) => norm(el.textContent) === text
  );
}

/**
 * "Next to": an element showing `value` whose own text, parent, or adjacent sibling
 * also shows `label` — without also showing `otherValue` (so the label is paired
 * with this value, not with the other rate).
 */
function isNextTo(container: HTMLElement, value: string, label: string, otherValue: string) {
  const holders = Array.from(container.querySelectorAll<HTMLElement>('*')).filter(
    (el) =>
      (el.textContent ?? '').includes(value) &&
      !Array.from(el.children).some((c) => (c.textContent ?? '').includes(value))
  );
  return holders.some((el) => {
    const near: (Element | null)[] = [
      el,
      el.parentElement,
      el.previousElementSibling,
      el.nextElementSibling,
    ];
    return near.some((n) => {
      const t = n?.textContent ?? '';
      return t.includes(label) && !t.includes(otherValue);
    });
  });
}

describe('ProfileView', () => {
  it('14. h1 is the name; shows years, and each rate next to its label', () => {
    const { container } = render(<ProfileView profile={mockProfile} highlight={[]} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ana Souza');
    expect(container.textContent).toContain('Brazil');
    expect(container.textContent).toContain('7.4 yrs');
    expect(container.textContent).toContain('$6,000/mo');
    expect(container.textContent).toContain('$3,000/mo');

    expect(isNextTo(container, '$6,000/mo', 'Full-time', '$3,000/mo')).toBe(true);
    expect(isNextTo(container, '$3,000/mo', 'Part-time', '$6,000/mo')).toBe(true);
  });

  it('15. Experience has 3 items; only the intern one shows a "Not counted" badge', () => {
    render(<ProfileView profile={mockProfile} highlight={[]} />);

    const items = within(sectionFor('Experience')).getAllByRole('listitem');
    expect(items).toHaveLength(3);

    const intern = items.find((li) => li.textContent?.includes('Software Engineering Intern'));
    expect(intern).toBeDefined();
    expect(intern!.textContent).toContain('Not counted: internship');

    for (const li of items) {
      if (li === intern) continue;
      expect(li.textContent).not.toMatch(/Not counted/);
    }
  });

  it('16. the first experience shows "Mar 2022 – Present"', () => {
    render(<ProfileView profile={mockProfile} highlight={[]} />);

    const [first] = within(sectionFor('Experience')).getAllByRole('listitem');
    expect(first.textContent).toContain('Senior Frontend Engineer');
    expect(first.textContent).toContain('Mar 2022 – Present');
  });

  it('17. highlight React: About has a <mark>React</mark>; the React skill chip is in a <mark>', () => {
    const { container } = render(<ProfileView profile={mockProfile} highlight={['React']} />);

    const bio = mockProfile.candidate.biography;
    const marks = Array.from(container.querySelectorAll('mark'));
    const inBio = marks.filter((m) => {
      if (norm(m.textContent) !== 'React') return false;
      for (let el = m.parentElement; el && el !== container; el = el.parentElement) {
        if (norm(el.textContent) === norm(bio)) return true;
      }
      return false;
    });
    expect(inBio.length).toBeGreaterThan(0);

    const skills = sectionFor('Skills');
    const reactChip = elementsWithText(skills, 'React · 3 roles · bio');
    expect(reactChip.length).toBeGreaterThan(0);
    expect(reactChip.some((el) => el.closest('mark') !== null)).toBe(true);

    const tsChip = elementsWithText(skills, 'TypeScript · 1 role · bio');
    expect(tsChip.length).toBeGreaterThan(0);
    for (const el of tsChip) expect(el.closest('mark')).toBeNull();
  });

  it('18. with no highlight terms there are no <mark> elements', () => {
    const { container } = render(<ProfileView profile={mockProfile} highlight={[]} />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
  });

  it('19. skill chips read "{name} · {n} role(s)" plus " · bio"', () => {
    render(<ProfileView profile={mockProfile} highlight={[]} />);

    const skills = sectionFor('Skills');
    for (const chip of ['React · 3 roles · bio', 'TypeScript · 1 role · bio', 'Node.js · 1 role']) {
      expect(elementsWithText(skills, chip).length, chip).toBeGreaterThan(0);
    }
  });

  it('20. a profile with no education shows "None listed" under Education', () => {
    const profile: CandidateProfile = { ...mockProfile, education: [] };
    render(<ProfileView profile={profile} highlight={[]} />);

    const education = sectionFor('Education');
    expect(within(education).getByText('None listed')).toBeInTheDocument();
    expect(within(education).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('21. the "Back to search" link points to /', () => {
    render(<ProfileView profile={mockProfile} highlight={[]} />);
    expect(screen.getByRole('link', { name: 'Back to search' })).toHaveAttribute('href', '/');
  });
});
