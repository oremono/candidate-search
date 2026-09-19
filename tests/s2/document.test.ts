import { describe, expect, it } from 'vitest';
import { buildResumeDocument, MAX_DOCUMENT_CHARS, type ResumeParts } from '@/lib/search/document';

const engineerAtAcme = { position: 'Engineer', company: 'Acme', description: 'Built APIs' };
const bscAtMit = { degree: 'BSc CS', school: 'MIT' };

describe('buildResumeDocument', () => {
  it('1. bio + one experience + one education → full layout', () => {
    const parts: ResumeParts = {
      biography: 'Rust dev',
      experiences: [engineerAtAcme],
      education: [bscAtMit],
    };
    expect(buildResumeDocument(parts)).toBe(
      'Rust dev\n\nExperience:\n- Engineer at Acme: Built APIs\n\nEducation:\n- BSc CS, MIT'
    );
  });

  it('2. experience with an empty description → "- Engineer at Acme"', () => {
    const doc = buildResumeDocument({
      biography: 'Rust dev',
      experiences: [{ position: 'Engineer', company: 'Acme', description: '' }],
      education: [],
    });
    expect(doc.split('\n')).toContain('- Engineer at Acme');
    expect(doc).not.toContain('Acme:');
    expect(doc).toBe('Rust dev\n\nExperience:\n- Engineer at Acme');
  });

  it('3. education with degree " " → "- MIT"', () => {
    const doc = buildResumeDocument({
      biography: 'Rust dev',
      experiences: [],
      education: [{ degree: ' ', school: 'MIT' }],
    });
    expect(doc.split('\n')).toContain('- MIT');
    expect(doc).not.toContain(', MIT');
    expect(doc).toBe('Rust dev\n\nEducation:\n- MIT');
  });

  it('4. no experiences and no education → just the bio', () => {
    expect(buildResumeDocument({ biography: 'Rust dev', experiences: [], education: [] })).toBe(
      'Rust dev'
    );
  });

  it('5. empty bio with one experience → starts with "Experience:"', () => {
    const doc = buildResumeDocument({
      biography: '',
      experiences: [engineerAtAcme],
      education: [],
    });
    expect(doc.startsWith('Experience:')).toBe(true);
    expect(doc).toBe('Experience:\n- Engineer at Acme: Built APIs');
  });

  it('6. a 10,000-character bio → length is exactly 6000', () => {
    expect(MAX_DOCUMENT_CHARS).toBe(6000);
    const doc = buildResumeDocument({
      biography: 'x'.repeat(10_000),
      experiences: [engineerAtAcme],
      education: [bscAtMit],
    });
    expect(doc).toHaveLength(6000);
    expect(doc).toBe('x'.repeat(6000));
  });
});
