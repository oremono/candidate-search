import { describe, expect, it } from 'vitest';
import { SKILLS, extractSkills } from '@/lib/derive/skills';

const CANONICAL = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'Kotlin',
  'Swift',
  'Go',
  'Rust',
  'C++',
  'C#',
  '.NET',
  'Ruby',
  'Ruby on Rails',
  'PHP',
  'Scala',
  'Elixir',
  'React',
  'React Native',
  'Angular',
  'Vue',
  'Next.js',
  'Node.js',
  'Django',
  'Flask',
  'FastAPI',
  'Spring',
  'AWS',
  'GCP',
  'Azure',
  'Docker',
  'Kubernetes',
  'Terraform',
  'SQL',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'GraphQL',
  'Machine Learning',
  'AI',
  'NLP',
  'LLM',
  'PyTorch',
  'TensorFlow',
  'Spark',
  'Flutter',
  'Android',
  'iOS',
  'Solidity',
  'Blockchain',
];

describe('SKILLS', () => {
  it('contains exactly the canonical list', () => {
    expect([...SKILLS].sort()).toEqual([...CANONICAL].sort());
    expect(new Set(SKILLS).size).toBe(SKILLS.length);
  });
});

describe('extractSkills', () => {
  const cases: [string, string, string[]][] = [
    ['17', 'Experienced in JavaScript and Java', ['Java', 'JavaScript']],
    ['18', 'React Native apps', ['React Native']],
    ['19', 'React and React Native', ['React', 'React Native']],
    ['20', "my go-to tool, let's go", []],
    ['21', 'Backend in Go and Golang', ['Go']],
    ['22', 'C++, C# and .NET', ['.NET', 'C#', 'C++']],
    ['23', 'HTML and XML parsing', []],
    ['24', 'Built ML pipelines with PyTorch', ['Machine Learning', 'PyTorch']],
    ['25', 'She said the email was sent', []],
    ['26', 'Postgres expert', ['PostgreSQL', 'SQL']],
    ['27', 'Worked on BIOS firmware scenarios', []],
    ['28', 'iOS and Android', ['Android', 'iOS']],
    ['29', '', []],
  ];

  it.each(cases)('%s. %j → %j', (_n, input, expected) => {
    const got = extractSkills(input);
    expect(got).toEqual(expected);
    for (const name of got) expect(SKILLS).toContain(name);
  });
});
