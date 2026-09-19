import type { CandidateProfile } from '@/lib/contracts';
import { mockSearchResponse } from './search';

/** Fixture for frontend work before the real API exists. Shape = contracts.ts. */
export const mockProfile: CandidateProfile = {
  candidate: mockSearchResponse.results[0].candidate,
  partTimeMonthlyRate: 3000,
  experiences: [
    {
      company: 'Nubank',
      position: 'Senior Frontend Engineer',
      description: 'Led the React design system used by 40 squads.',
      startDate: '2022-03-01',
      endDate: null,
      effectiveEndDate: '2026-09-19',
      counted: true,
      excludedReason: null,
    },
    {
      company: 'Nubank',
      position: 'Frontend Engineer',
      description: 'Built onboarding flows in React and TypeScript.',
      startDate: '2019-01-01',
      endDate: null,
      effectiveEndDate: '2022-03-01',
      counted: true,
      excludedReason: null,
    },
    {
      company: 'Globo',
      position: 'Software Engineering Intern',
      description: 'Internal tooling.',
      startDate: '2018-01-01',
      endDate: '2018-12-01',
      effectiveEndDate: null,
      counted: false,
      excludedReason: 'intern',
    },
  ],
  education: [
    {
      school: 'Universidade de São Paulo',
      degree: 'BSc Computer Science',
      startDate: '2015-01-01',
      endDate: '2019-01-01',
    },
  ],
  skills: [
    { name: 'React', inBio: true, roleCount: 3 },
    { name: 'TypeScript', inBio: true, roleCount: 1 },
    { name: 'Node.js', inBio: false, roleCount: 1 },
  ],
};
