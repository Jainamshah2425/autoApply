jest.mock('../models/LiveInterviewSession.js', () => ({
  aggregate: jest.fn(),
}));

const LiveInterviewSession = require('../models/LiveInterviewSession.js');
const { getRollingCategoryScores, pickWeakestCategory } = require('./liveInterviewService.js');

describe('pickWeakestCategory', () => {
  it('picks the lowest-scoring category', () => {
    expect(pickWeakestCategory({ communication: 8, technical: 5, problemSolving: 7, confidence: 9, sampleSize: 3 }))
      .toBe('technical');
  });

  it('breaks ties alphabetically for determinism', () => {
    expect(pickWeakestCategory({ communication: 5, technical: 5, problemSolving: 9, confidence: 9, sampleSize: 2 }))
      .toBe('communication');
  });

  it('returns null when there is no data', () => {
    expect(pickWeakestCategory(null)).toBeNull();
  });

  it('ignores non-numeric fields (e.g. sampleSize/_id) when picking the minimum', () => {
    expect(pickWeakestCategory({ _id: null, communication: 5, technical: 10, problemSolving: 10, confidence: 10, sampleSize: 4 }))
      .toBe('communication');
  });
});

describe('getRollingCategoryScores', () => {
  beforeEach(() => {
    LiveInterviewSession.aggregate.mockReset();
  });

  it('returns the aggregation result when sessions exist', async () => {
    LiveInterviewSession.aggregate.mockResolvedValue([
      { communication: 7, technical: 6, problemSolving: 8, confidence: 7, sampleSize: 5 },
    ]);
    const result = await getRollingCategoryScores('507f191e810c19729de860ea');
    expect(result).toEqual({ communication: 7, technical: 6, problemSolving: 8, confidence: 7, sampleSize: 5 });
  });

  it('returns null when the user has no completed sessions', async () => {
    LiveInterviewSession.aggregate.mockResolvedValue([]);
    const result = await getRollingCategoryScores('507f191e810c19729de860eb');
    expect(result).toBeNull();
  });
});
