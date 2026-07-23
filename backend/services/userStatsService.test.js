jest.mock('../models/InterviewSession', () => ({ aggregate: jest.fn() }));
jest.mock('../models/LiveInterviewSession', () => ({ aggregate: jest.fn() }));
jest.mock('../models/AptitudeAttempt', () => ({ aggregate: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('./aptitudeService', () => ({ getWeakTopics: jest.fn() }));

const InterviewSession = require('../models/InterviewSession');
const LiveInterviewSession = require('../models/LiveInterviewSession');
const AptitudeAttempt = require('../models/AptitudeAttempt');
const User = require('../models/User');
const aptitudeService = require('./aptitudeService');
const { getCanonicalStats } = require('./userStatsService');

describe('getCanonicalStats', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('merges all three collections into the canonical shape', async () => {
    InterviewSession.aggregate.mockResolvedValue([
      { totalSessions: 4, completedSessions: 3, averageScore: 7, totalQuestions: 20, totalResponses: 18 },
    ]);
    LiveInterviewSession.aggregate.mockResolvedValue([
      {
        totalSessions: 2, completedSessions: 2, averageScore: 6,
        avgCommunication: 7, avgTechnical: 5, avgProblemSolving: 6, avgConfidence: 8,
        behavioralCount: 1, technicalCount: 1, codingCount: 0,
      },
    ]);
    AptitudeAttempt.aggregate.mockResolvedValue([
      {
        overall: [{ totalAttempts: 5, averagePercentage: 72 }],
        topics: [
          { _id: 'percentages', correct: 3, total: 5 },
          { _id: 'syllogisms', correct: 8, total: 10 },
        ],
      },
    ]);
    aptitudeService.getWeakTopics.mockResolvedValue(['percentages']);
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ contributions: [], stats: {} }) });

    const stats = await getCanonicalStats('507f191e810c19729de860ea');

    expect(stats.interview).toEqual({
      totalSessions: 4, completedSessions: 3, completionRate: 75,
      averageScore: 7, totalQuestions: 20, totalResponses: 18,
    });
    expect(stats.liveInterview.categoryScores).toEqual({
      communication: 7, technical: 5, problemSolving: 6, confidence: 8,
    });
    expect(stats.aptitude.averagePercentage).toBe(72);
    expect(stats.aptitude.topicBreakdown).toEqual(
      expect.arrayContaining([
        { topic: 'percentages', correct: 3, total: 5, percentage: 60 },
        { topic: 'syllogisms', correct: 8, total: 10, percentage: 80 },
      ])
    );
    expect(stats.aptitude.weakTopics).toEqual(['percentages']);
    // Delegates to aptitudeService rather than reimplementing the threshold math.
    expect(aptitudeService.getWeakTopics).toHaveBeenCalledTimes(1);
    expect(aptitudeService.getWeakTopics).toHaveBeenCalledWith('507f191e810c19729de860ea');
  });

  it('defaults to zero/empty for a brand-new user with no documents anywhere', async () => {
    InterviewSession.aggregate.mockResolvedValue([]);
    LiveInterviewSession.aggregate.mockResolvedValue([]);
    AptitudeAttempt.aggregate.mockResolvedValue([{ overall: [], topics: [] }]);
    aptitudeService.getWeakTopics.mockResolvedValue([]);
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ contributions: [], stats: {} }) });

    const stats = await getCanonicalStats('507f191e810c19729de860eb');

    expect(stats.interview.totalSessions).toBe(0);
    expect(stats.interview.averageScore).toBeNull();
    expect(stats.aptitude.totalAttempts).toBe(0);
    expect(stats.aptitude.averagePercentage).toBeNull();
    expect(stats.combined.overallAverageScore).toBeNull();
    expect(stats.combined.currentStreak).toBe(0);
  });

  it('combined.overallAverageScore averages the two interview sources (both already on their native scale)', async () => {
    InterviewSession.aggregate.mockResolvedValue([
      { totalSessions: 1, completedSessions: 1, averageScore: 6, totalQuestions: 5, totalResponses: 5 },
    ]);
    LiveInterviewSession.aggregate.mockResolvedValue([
      { totalSessions: 1, completedSessions: 1, averageScore: 8, avgCommunication: null, avgTechnical: null, avgProblemSolving: null, avgConfidence: null, behavioralCount: 1, technicalCount: 0, codingCount: 0 },
    ]);
    AptitudeAttempt.aggregate.mockResolvedValue([{ overall: [], topics: [] }]);
    aptitudeService.getWeakTopics.mockResolvedValue([]);
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    const stats = await getCanonicalStats('507f191e810c19729de860ec');
    expect(stats.combined.overallAverageScore).toBe(7);
  });
});
