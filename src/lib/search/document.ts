/** The resume text that gets embedded: bio, then experience, then education. */

export interface ResumeParts {
  biography: string;
  experiences: { position: string; company: string; description: string }[];
  education: { degree: string; school: string }[];
}

/** Longer documents are cut to this many characters, keeping the start. */
export const MAX_DOCUMENT_CHARS = 6000;

/** Build the plain-text resume document (layout in docs/slices/S2-search-index.md). */
export function buildResumeDocument(parts: ResumeParts): string {
  const sections: string[] = [];

  const bio = parts.biography.trim();
  if (bio) sections.push(bio);

  if (parts.experiences.length > 0) {
    const lines = parts.experiences.map((e) => {
      const head = `- ${e.position.trim()} at ${e.company.trim()}`;
      const description = e.description.trim();
      return description ? `${head}: ${description}` : head;
    });
    sections.push(['Experience:', ...lines].join('\n'));
  }

  if (parts.education.length > 0) {
    const lines = parts.education.map((e) => {
      const degree = e.degree.trim();
      return degree ? `- ${degree}, ${e.school.trim()}` : `- ${e.school.trim()}`;
    });
    sections.push(['Education:', ...lines].join('\n'));
  }

  // Multi-line bios and descriptions: trim every line, not just each entry.
  const document = sections
    .join('\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
  return document.slice(0, MAX_DOCUMENT_CHARS);
}
