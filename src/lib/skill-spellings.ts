/**
 * Plain-text spellings of a skill, used only to highlight it in resume text.
 * Tagging uses the regex patterns in src/lib/derive/skills.ts; keep the two in step.
 */
const SPELLINGS: Record<string, string[]> = {
  JavaScript: ['JavaScript', 'JS'],
  TypeScript: ['TypeScript', 'TS'],
  React: ['React', 'ReactJS', 'React.js', 'MERN'],
  'React Native': ['React Native', 'React-Native'],
  Angular: ['Angular', 'MEAN'],
  Vue: ['Vue', 'MEVN'],
  'Node.js': ['Node.js', 'NodeJS', 'Node', 'MERN', 'MEAN', 'MEVN'],
  Express: ['Express', 'Express.js', 'ExpressJS', 'MERN', 'MEAN', 'MEVN'],
  MongoDB: ['MongoDB', 'Mongo', 'MERN', 'MEAN', 'MEVN'],
  'Next.js': ['Next.js', 'NextJS'],
  Go: ['Go', 'Golang'],
  'C++': ['C++', 'cpp'],
  'C#': ['C#', 'csharp'],
  '.NET': ['.NET', 'dotnet', 'ASP.NET'],
  'Ruby on Rails': ['Ruby on Rails', 'Rails'],
  PostgreSQL: ['PostgreSQL', 'Postgres'],
  'Machine Learning': ['Machine Learning', 'ML'],
  AI: ['AI', 'Artificial Intelligence'],
  NLP: ['NLP', 'Natural Language Processing'],
  LLM: ['LLM', 'LLMs', 'Large Language Model', 'Large Language Models'],
  AWS: ['AWS', 'Amazon Web Services'],
  GCP: ['GCP', 'Google Cloud'],
  Kubernetes: ['Kubernetes', 'k8s'],
};

/** Every spelling of the given skills; unknown terms pass through unchanged. */
export function highlightTermsFor(skills: string[]): string[] {
  return [...new Set(skills.flatMap((skill) => SPELLINGS[skill] ?? [skill]))];
}
