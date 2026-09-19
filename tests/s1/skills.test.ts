import { describe, expect, it } from 'vitest';
import { SKILLS, STACKS, extractSkills, stackSkills } from '@/lib/derive/skills';

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
  'Express',
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

// Spec: docs/slices/S4-nl-search.md, S4-back > Addendum: stack acronyms and LLM field guard
// (test list 39–46).
describe('stack acronyms and Express (S4 addendum)', () => {
  it("39. SKILLS includes 'Express'; STACKS.MERN is MongoDB, Express, React, Node.js", () => {
    expect(SKILLS).toContain('Express');
    expect(STACKS.MERN).toEqual(['MongoDB', 'Express', 'React', 'Node.js']);
  });

  it("40. 'MERN developer' → exactly the four MERN members", () => {
    expect(extractSkills('MERN developer')).toEqual(['Express', 'MongoDB', 'Node.js', 'React']);
  });

  it("41. 'MEAN stack' → exactly the four MEAN members; 'MEVN' includes Vue", () => {
    expect(extractSkills('MEAN stack')).toEqual(['Angular', 'Express', 'MongoDB', 'Node.js']);
    expect(extractSkills('MEVN')).toContain('Vue');
  });

  it("42. 'the mean value of a set' → []", () => {
    expect(extractSkills('the mean value of a set')).toEqual([]);
  });

  it.each(['APIs in Node.js and Express.js', 'ExpressJS services', 'Node/Express backend'])(
    '43. %j tags Express',
    (input) => {
      expect(extractSkills(input)).toContain('Express');
    }
  );

  it.each([
    'Data Scientist for American Express',
    'used regular expressions',
    'emotions expressed in tweets',
    'Spring Expression Language',
    'PhotoshopExpress app',
  ])('44. %j does not tag Express', (input) => {
    expect(extractSkills(input)).not.toContain('Express');
  });

  it("45. 'Mongo and Redis' → ['MongoDB', 'Redis']", () => {
    expect(extractSkills('Mongo and Redis')).toEqual(['MongoDB', 'Redis']);
  });

  it("46. stackSkills('MERN or MEAN dev') → union of members; 'react dev' → []", () => {
    expect(stackSkills('MERN or MEAN dev')).toEqual([
      'Angular',
      'Express',
      'MongoDB',
      'Node.js',
      'React',
    ]);
    expect(stackSkills('react dev')).toEqual([]);
  });
});
