const { computeTopicQuotas, mergeQuotaResults } = require('./aptitudeSelection');

describe('computeTopicQuotas', () => {
  it('falls back to all-general when there are no weak topics', () => {
    expect(computeTopicQuotas({ questionCount: 20, weakTopics: [] }))
      .toEqual({ weakQuota: 0, otherQuota: 20 });
  });

  it('splits ~55/45 toward weak topics when present', () => {
    expect(computeTopicQuotas({ questionCount: 20, weakTopics: ['percentages'] }))
      .toEqual({ weakQuota: 11, otherQuota: 9 });
  });

  it('respects a custom weakRatio', () => {
    expect(computeTopicQuotas({ questionCount: 10, weakTopics: ['a'], weakRatio: 0.8 }))
      .toEqual({ weakQuota: 8, otherQuota: 2 });
  });

  it('never exceeds questionCount even with a large ratio', () => {
    const { weakQuota, otherQuota } = computeTopicQuotas({ questionCount: 5, weakTopics: ['a'], weakRatio: 1 });
    expect(weakQuota).toBe(5);
    expect(otherQuota).toBe(0);
  });

  it('returns zeros for a non-positive questionCount', () => {
    expect(computeTopicQuotas({ questionCount: 0, weakTopics: ['a'] }))
      .toEqual({ weakQuota: 0, otherQuota: 0 });
    expect(computeTopicQuotas({ questionCount: -5, weakTopics: ['a'] }))
      .toEqual({ weakQuota: 0, otherQuota: 0 });
  });
});

describe('mergeQuotaResults', () => {
  it('combines both pools when they exactly fill the quota', () => {
    const result = mergeQuotaResults({
      weakPoolQuestions: [{ id: 1 }, { id: 2 }],
      otherPoolQuestions: [{ id: 3 }],
      questionCount: 3,
    });
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('truncates when the combined pools exceed questionCount', () => {
    const result = mergeQuotaResults({
      weakPoolQuestions: [{ id: 1 }, { id: 2 }],
      otherPoolQuestions: [{ id: 3 }, { id: 4 }],
      questionCount: 3,
    });
    expect(result).toHaveLength(3);
  });

  it('returns fewer than requested when both pools are short, for the caller to top up', () => {
    const result = mergeQuotaResults({
      weakPoolQuestions: [{ id: 1 }],
      otherPoolQuestions: [],
      questionCount: 5,
    });
    expect(result).toHaveLength(1);
  });
});
