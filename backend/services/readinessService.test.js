jest.mock('./userStatsService', () => ({
  getCanonicalStats: jest.fn(),
}));
jest.mock('../models/User', () => ({
  findById: jest.fn(),
}));
jest.mock('../models/Resume', () => ({
  findOne: jest.fn(),
}));

const {
  computeReadinessScore,
  computeResumeSkillCoverage,
  buildRecommendations,
  getReadiness,
} = require('./readinessService');

const userStatsService = require('./userStatsService');
const User = require('../models/User');
const Resume = require('../models/Resume');

describe('computeReadinessScore', () => {
  it('computes a weighted average when all three dimensions are present', () => {
    const { overall, weights } = computeReadinessScore({
      aptitudeScore: 80,
      interviewScore: 60,
      resumeCoverageScore: 50,
    });
    // 80*0.4 + 60*0.4 + 50*0.2 = 32 + 24 + 10 = 66
    expect(overall).toBe(66);
    expect(weights).toEqual({ aptitude: 40, interview: 40, resumeCoverage: 20 });
  });

  it('re-weights proportionally when one dimension is missing', () => {
    const { overall, weights } = computeReadinessScore({
      aptitudeScore: 80,
      interviewScore: 60,
      resumeCoverageScore: null,
    });
    // remaining weights 0.4/0.4 renormalize to 0.5/0.5 -> 80*0.5 + 60*0.5 = 70
    expect(overall).toBe(70);
    expect(weights).toEqual({ aptitude: 50, interview: 50 });
  });

  it('returns null overall when no dimensions are present', () => {
    expect(computeReadinessScore({ aptitudeScore: null, interviewScore: null, resumeCoverageScore: null }))
      .toEqual({ overall: null, weights: {} });
  });
});

describe('computeResumeSkillCoverage', () => {
  it('matches case-insensitively', () => {
    const result = computeResumeSkillCoverage({
      resumeText: 'Experienced with React and Node.js.',
      targetSkills: ['react', 'Docker'],
    });
    expect(result.coveragePercent).toBe(50);
    expect(result.matched).toEqual(['react']);
    expect(result.missing).toEqual(['Docker']);
  });

  it('returns null coverage when there are no target skills', () => {
    expect(computeResumeSkillCoverage({ resumeText: 'anything', targetSkills: [] }))
      .toEqual({ coveragePercent: null, matched: [], missing: [] });
  });

  it('handles a missing resume gracefully', () => {
    const result = computeResumeSkillCoverage({ resumeText: undefined, targetSkills: ['Python'] });
    expect(result.coveragePercent).toBe(0);
    expect(result.missing).toEqual(['Python']);
  });
});

describe('buildRecommendations', () => {
  it('surfaces the weakest dimensions first, naming actual weak topics', () => {
    const recs = buildRecommendations({
      aptitudeScore: 30,
      interviewScore: 90,
      resumeCoverage: { coveragePercent: 80, missing: [] },
      weakAptitudeTopics: ['percentages', 'time-work'],
    });
    expect(recs[0]).toMatch(/percentages, time-work/);
  });

  it('falls back to a generic message when fewer than 2 dimensions have data', () => {
    const recs = buildRecommendations({ aptitudeScore: 40, weakAptitudeTopics: [] });
    expect(recs.length).toBeGreaterThanOrEqual(2);
  });

  it('caps recommendations at 3', () => {
    const recs = buildRecommendations({
      aptitudeScore: 10,
      interviewScore: 20,
      resumeCoverage: { coveragePercent: 30, missing: ['Docker'] },
      weakAptitudeTopics: ['a'],
    });
    expect(recs.length).toBeLessThanOrEqual(3);
  });
});

describe('getReadiness', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('normalizes both 1-10 interview score sources to 0-100 before combining', async () => {
    userStatsService.getCanonicalStats.mockResolvedValue({
      aptitude: { completedAttempts: 5, averagePercentage: 70, weakTopics: [] },
      interview: { averageScore: 6, completedSessions: 3 },
      liveInterview: { averageScore: 8, completedSessions: 2 },
    });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ preferences: { skills: [] }, settings: {} }) });
    Resume.findOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) }) });

    const readiness = await getReadiness('user-1');

    // interview: (6*10 + 8*10) / 2 = 70; aptitude 70; resumeCoverage null -> re-weighted 50/50
    expect(readiness.dimensions.interview.score).toBe(70);
    expect(readiness.dimensions.aptitude.score).toBe(70);
    expect(readiness.overall).toBe(70);
  });

  it('treats a brand-new user (no data anywhere) as null overall, not zero', async () => {
    userStatsService.getCanonicalStats.mockResolvedValue({
      aptitude: { completedAttempts: 0, averagePercentage: null, weakTopics: [] },
      interview: { averageScore: null, completedSessions: 0 },
      liveInterview: { averageScore: null, completedSessions: 0 },
    });
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    Resume.findOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) }) });

    const readiness = await getReadiness('user-2');
    expect(readiness.overall).toBeNull();
  });
});
