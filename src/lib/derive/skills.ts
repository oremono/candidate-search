/** Canonical skill names. */
export const SKILLS: readonly string[] = [
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

/** Case-insensitive term (regex source). */
const ci = (source: string) => ({ source, flags: 'i' });
/** Case-sensitive term (regex source). */
const cs = (source: string) => ({ source, flags: '' });

/** Terms that differ from the canonical name. Other skills match their own name. */
const ALIASES: Record<string, { source: string; flags: string }[]> = {
  JavaScript: [ci('javascript'), cs('JS')],
  TypeScript: [ci('typescript'), cs('TS')],
  'React Native': [ci('react[\\s-]+native')],
  React: [ci('react(?![\\s-]+native)'), ci('react\\.js'), ci('reactjs')],
  'Node.js': [ci('node'), ci('node\\.js'), ci('nodejs')],
  'Next.js': [ci('next\\.js'), ci('nextjs')],
  Express: [ci('express(?:\\.js|js| js)'), cs('(?<!American )Express')],
  MongoDB: [ci('mongodb'), ci('mongo')],
  Go: [ci('golang'), cs('Go(?!-)')],
  'C++': [ci('c\\+\\+'), ci('cpp')],
  'C#': [ci('c#'), ci('csharp')],
  '.NET': [ci('\\.net'), ci('dotnet'), ci('asp\\.net')],
  Ruby: [ci('ruby'), ci('rails')],
  'Ruby on Rails': [ci('rails'), ci('ruby on rails')],
  SQL: [ci('sql'), ci('postgres'), ci('postgresql'), ci('mysql')],
  PostgreSQL: [ci('postgres'), ci('postgresql')],
  'Machine Learning': [ci('machine learning'), cs('ML')],
  AI: [cs('AI'), ci('artificial intelligence')],
  NLP: [ci('nlp'), ci('natural language processing')],
  LLM: [ci('llms?'), ci('large language models?')],
  AWS: [ci('aws'), ci('amazon web services')],
  GCP: [ci('gcp'), ci('google cloud')],
  Kubernetes: [ci('kubernetes'), ci('k8s')],
};

/** Stack acronyms and their member skills. An acronym (all caps) tags every member. */
export const STACKS: Record<string, readonly string[]> = {
  MERN: ['MongoDB', 'Express', 'React', 'Node.js'],
  MEAN: ['MongoDB', 'Express', 'Angular', 'Node.js'],
  MEVN: ['MongoDB', 'Express', 'Vue', 'Node.js'],
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Terms for a skill: its aliases (or its own name), plus any stack acronym it belongs to. */
function termsFor(skill: string) {
  const acronyms = Object.keys(STACKS).filter((stack) => STACKS[stack].includes(skill));
  return [...(ALIASES[skill] ?? [ci(escapeRegex(skill))]), ...acronyms.map(cs)];
}

/** Each skill with the patterns that tag it. A match can't be glued to a letter or digit. */
const MATCHERS: [string, RegExp[]][] = SKILLS.map((skill) => [
  skill,
  termsFor(skill).map(
    ({ source, flags }) => new RegExp(`(?<![A-Za-z0-9])(?:${source})(?![A-Za-z0-9])`, flags)
  ),
]);

/** Canonical skills mentioned in the text, deduplicated and sorted. */
export function extractSkills(text: string): string[] {
  return MATCHERS.filter(([, patterns]) => patterns.some((re) => re.test(text)))
    .map(([skill]) => skill)
    .sort();
}

/** Members of every stack acronym in the text, deduplicated and sorted. */
export function stackSkills(text: string): string[] {
  const members = Object.entries(STACKS)
    .filter(([stack]) => new RegExp(`(?<![A-Za-z0-9])${stack}(?![A-Za-z0-9])`).test(text))
    .flatMap(([, skills]) => skills);
  return [...new Set(members)].sort();
}
