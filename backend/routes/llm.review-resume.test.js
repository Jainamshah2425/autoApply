const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../models/Resume', () => ({
  findOne: jest.fn(),
}));

jest.mock('../services/resumeReview', () => ({
  generateResumeReview: jest.fn(),
}));

jest.mock('../services/coverLetter', () => ({
  generateCoverLetter: jest.fn(),
}));

jest.mock('../services/llm', () => ({
  generateImprovedAnswer: jest.fn(),
}));

const Resume = require('../models/Resume');
const { generateResumeReview } = require('../services/resumeReview');
const llmRoutes = require('./llm');
const errorHandler = require('../middleware/errorHandler');

const SECRET = 'test-secret';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/llm', llmRoutes);
  app.use(errorHandler);
  return app;
}

function authHeader(userId = 'user-1') {
  const token = jwt.sign({ userId, email: 'a@b.com' }, SECRET);
  return `Bearer ${token}`;
}

describe('POST /api/llm/review-resume', () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;
  let app;

  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = SECRET;
    app = buildApp();
  });

  afterAll(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
  });

  beforeEach(() => {
    Resume.findOne.mockReset();
    generateResumeReview.mockReset();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/llm/review-resume').send({});
    expect(res.status).toBe(401);
  });

  it('returns 404 when user has no resume', async () => {
    Resume.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue(null),
    });

    const res = await request(app)
      .post('/api/llm/review-resume')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/upload a resume/i);
  });

  it('returns review on success', async () => {
    Resume.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({ text: 'Jane Doe resume' }),
    });
    generateResumeReview.mockResolvedValue({
      overallScore: 75,
      summary: 'Solid',
      strengths: ['Projects'],
      gaps: ['Metrics'],
      atsTips: ['Keywords'],
      sectionFeedback: {
        contact: 'ok',
        experience: 'ok',
        skills: 'ok',
        education: 'ok',
      },
    });

    const res = await request(app)
      .post('/api/llm/review-resume')
      .set('Authorization', authHeader())
      .send({
        jobTitle: 'Intern',
        jobDescription: 'Build APIs',
      });

    expect(res.status).toBe(200);
    expect(res.body.review.overallScore).toBe(75);
    expect(generateResumeReview).toHaveBeenCalledWith(
      expect.objectContaining({
        resumeText: 'Jane Doe resume',
        jobTitle: 'Intern',
        jobDescription: 'Build APIs',
        userId: 'user-1',
      })
    );
  });

  it('returns 502 when review service signals bad LLM JSON', async () => {
    Resume.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({ text: 'resume' }),
    });
    const err = new Error('Resume review failed: invalid JSON from LLM');
    err.status = 502;
    generateResumeReview.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/llm/review-resume')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(502);
  });
});
