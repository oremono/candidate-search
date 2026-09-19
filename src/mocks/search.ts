import type { FilterOptions, SearchResponse } from '@/lib/contracts';

/** Fixture for frontend work before the real API exists. Shape = contracts.ts. */
export const mockFilterOptions: FilterOptions = {
  countries: [
    { name: 'India', count: 675 },
    { name: 'Brazil', count: 227 },
    { name: 'Costa Rica', count: 16 },
  ],
  skills: [
    { name: 'Python', count: 453 },
    { name: 'React', count: 271 },
    { name: 'Rust', count: 7 },
  ],
};

export const mockSearchResponse: SearchResponse = {
  filters: {
    countries: ['Brazil'],
    skills: ['React'],
    minYears: 5,
    maxYears: null,
    minSalary: null,
    maxSalary: 120000,
  },
  total: 23,
  results: [
    {
      candidate: {
        id: 101,
        name: 'Ana Souza',
        country: 'Brazil',
        yearsExperience: 7.4,
        monthlyRate: 6000,
        rateUnverified: false,
        availability: { fullTime: true, partTime: true, contractor: true, employee: true },
        biography: 'Frontend lead building React and TypeScript design systems for fintech.',
        topSkills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
      },
      score: 3.2,
      matchedSkills: ['React'],
      reasons: [
        { kind: 'skill', label: 'React in 3 roles and bio' },
        { kind: 'experience', label: '7.4 yrs experience (min 5)' },
        { kind: 'salary', label: '$72,000/yr, under $120,000' },
        { kind: 'country', label: 'Based in Brazil' },
      ],
    },
    {
      candidate: {
        id: 202,
        name: 'Bruno Lima',
        country: 'Brazil',
        yearsExperience: 5.1,
        monthlyRate: null,
        rateUnverified: true,
        availability: { fullTime: true, partTime: false, contractor: true, employee: false },
        biography: 'Full-stack engineer, React and Django.',
        topSkills: ['React', 'Python', 'Django'],
      },
      score: 2.1,
      matchedSkills: ['React'],
      reasons: [
        { kind: 'skill', label: 'React in 1 role' },
        { kind: 'experience', label: '5.1 yrs experience (min 5)' },
        { kind: 'country', label: 'Based in Brazil' },
      ],
    },
  ],
};

export const mockEmptySearchResponse: SearchResponse = {
  filters: {
    countries: ['Canada'],
    skills: [],
    minYears: null,
    maxYears: null,
    minSalary: null,
    maxSalary: null,
  },
  total: 0,
  results: [],
};
