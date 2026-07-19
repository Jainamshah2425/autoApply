const {
  buildResumeReviewPrompt,
  parseResumeReview,
  generateResumeReview,
  MAX_RESUME_CHARS,
} = require('./resumeReview');

jest.mock('./llm', () => ({
  getLLMResponse: jest.fn(),
}));

const { getLLMResponse } = require('./llm');

describe('buildResumeReviewPrompt', () => {
  it('includes resume text and truncates long resumes', () => {
    const long = 'x'.repeat(MAX_RESUME_CHARS + 500);
    const prompt = buildResumeReviewPrompt({ resumeText: long });
    expect(prompt).toContain('--- START RESUME ---');
    expect(prompt).toContain('x'.repeat(100));
    expect(prompt.length).toBeLessThan(long.length + 2000);
  });

  it('includes target role when provided', () => {
    const prompt = buildResumeReviewPrompt({
      resumeText: 'Jane Doe intern',
      jobTitle: 'Software Engineer Intern',
      jobDescription: 'Python and React',
    });
    expect(prompt).toContain('Software Engineer Intern');
    expect(prompt).toContain('Python and React');
  });
});

describe('parseResumeReview', () => {
  const valid = {
    overallScore: 72,
    summary: 'Solid early-career resume with clear projects.',
    strengths: ['Clear project bullets', 'Relevant skills'],
    gaps: ['Missing metrics'],
    atsTips: ['Use standard section headings'],
    sectionFeedback: {
      contact: 'Email present',
      experience: 'Add impact metrics',
      skills: 'Group by category',
      education: 'Include graduation date',
    },
  };

  it('parses a valid JSON string', () => {
    const review = parseResumeReview(JSON.stringify(valid));
    expect(review.overallScore).toBe(72);
    expect(review.strengths).toHaveLength(2);
    expect(review.sectionFeedback.skills).toBe('Group by category');
  });

  it('clamps score and fills missing arrays/sections', () => {
    const review = parseResumeReview(JSON.stringify({
      overallScore: 150,
      summary: 'Ok',
    }));
    expect(review.overallScore).toBe(100);
    expect(review.strengths).toEqual([]);
    expect(review.sectionFeedback.contact).toBe('No feedback.');
  });

  it('throws 502 on invalid JSON', () => {
    expect(() => parseResumeReview('not-json{')).toThrow(/invalid JSON/);
    try {
      parseResumeReview('not-json{');
    } catch (err) {
      expect(err.status).toBe(502);
    }
  });
});

describe('generateResumeReview', () => {
  beforeEach(() => {
    getLLMResponse.mockReset();
  });

  it('returns normalized review on success', async () => {
    getLLMResponse.mockResolvedValue(JSON.stringify({
      overallScore: 80,
      summary: 'Good fit for internships.',
      strengths: ['Projects'],
      gaps: ['No internship'],
      atsTips: ['PDF text layer'],
      sectionFeedback: {
        contact: 'Fine',
        experience: 'Expand',
        skills: 'Fine',
        education: 'Fine',
      },
    }));

    const review = await generateResumeReview({
      resumeText: 'Jane Doe — CS student with React projects.',
      jobTitle: 'Frontend Intern',
      userId: 'user-1',
    });

    expect(getLLMResponse).toHaveBeenCalledWith(
      expect.any(String),
      'user-1',
      expect.objectContaining({ jsonMode: true })
    );
    expect(review.overallScore).toBe(80);
    expect(review.gaps[0]).toBe('No internship');
  });

  it('rejects empty resume text with 400', async () => {
    await expect(generateResumeReview({ resumeText: '   ' })).rejects.toMatchObject({
      message: expect.stringMatching(/empty/i),
      status: 400,
    });
    expect(getLLMResponse).not.toHaveBeenCalled();
  });

  it('surfaces 502 when LLM returns bad JSON', async () => {
    getLLMResponse.mockResolvedValue('sorry, here is advice...');
    await expect(
      generateResumeReview({ resumeText: 'Some resume text' })
    ).rejects.toMatchObject({ status: 502 });
  });
});
