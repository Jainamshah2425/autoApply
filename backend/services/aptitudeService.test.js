jest.mock('../models/AptitudeQuestion.js', () => ({
  find: jest.fn(),
  bulkWrite: jest.fn(),
}));
jest.mock('../models/AptitudeAttempt.js', () => ({
  findById: jest.fn(),
}));
jest.mock('./llm.js', () => ({ getLLMResponse: jest.fn() }));

const AptitudeQuestion = require('../models/AptitudeQuestion.js');
const AptitudeAttempt = require('../models/AptitudeAttempt.js');
const { submitTest } = require('./aptitudeService.js');

function makeQuestion({ _id, correctAnswer, topic = 'percentages' }) {
  return { _id, correctAnswer, topic };
}

describe('submitTest', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('scores answers and persists question stats via a single bulkWrite, not per-question save()', async () => {
    const q1 = makeQuestion({ _id: 'q1', correctAnswer: 0 });
    const q2 = makeQuestion({ _id: 'q2', correctAnswer: 1 });

    const attemptQuestions = [
      { questionId: 'q1', selectedAnswer: null, isCorrect: null, skipped: true },
      { questionId: 'q2', selectedAnswer: null, isCorrect: null, skipped: true },
    ];
    const attempt = {
      status: 'in-progress',
      totalQuestions: 2,
      questions: attemptQuestions,
      save: jest.fn().mockResolvedValue(undefined),
    };

    AptitudeAttempt.findById.mockResolvedValue(attempt);
    AptitudeQuestion.find.mockResolvedValue([q1, q2]);

    const results = await submitTest('attempt1', [
      { questionId: 'q1', selectedAnswer: 0, timeSpentSeconds: 10 }, // correct
      { questionId: 'q2', selectedAnswer: 0, timeSpentSeconds: 5 },  // incorrect
    ]);

    // Atomic $inc via one bulkWrite call, not question.save() in a loop.
    expect(AptitudeQuestion.bulkWrite).toHaveBeenCalledTimes(1);
    const ops = AptitudeQuestion.bulkWrite.mock.calls[0][0];
    expect(ops).toEqual(
      expect.arrayContaining([
        { updateOne: { filter: { _id: 'q1' }, update: { $inc: { timesAttempted: 1, timesCorrect: 1 } } } },
        { updateOne: { filter: { _id: 'q2' }, update: { $inc: { timesAttempted: 1, timesCorrect: 0 } } } },
      ])
    );
    expect(ops).toHaveLength(2);

    expect(results.score).toBe(1);
    expect(results.percentage).toBe(50);
  });

  it('skips bulkWrite entirely when nothing was answered', async () => {
    const q1 = makeQuestion({ _id: 'q1', correctAnswer: 0 });
    const attempt = {
      status: 'in-progress',
      totalQuestions: 1,
      questions: [{ questionId: 'q1', selectedAnswer: null, isCorrect: null, skipped: true }],
      save: jest.fn().mockResolvedValue(undefined),
    };

    AptitudeAttempt.findById.mockResolvedValue(attempt);
    AptitudeQuestion.find.mockResolvedValue([q1]);

    await submitTest('attempt2', []);

    expect(AptitudeQuestion.bulkWrite).not.toHaveBeenCalled();
  });

  it('rejects a second submission of an already-completed attempt', async () => {
    AptitudeAttempt.findById.mockResolvedValue({ status: 'completed' });

    await expect(submitTest('attempt3', [])).rejects.toThrow('Test already submitted');
    expect(AptitudeQuestion.bulkWrite).not.toHaveBeenCalled();
  });
});
