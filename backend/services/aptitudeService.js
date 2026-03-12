// services/aptitudeService.js
// Handles test generation, scoring, adaptive difficulty, and analytics.

const AptitudeQuestion = require('../models/AptitudeQuestion.js');
const AptitudeAttempt = require('../models/AptitudeAttempt.js');

/**
 * Generate a test with questions based on user preferences and weak areas.
 */
async function generateTest(userId, options = {}) {
  const {
    category = 'mixed',        // quantitative, logical, verbal, or mixed
    topic = null,              // specific topic, or null for all
    difficulty = null,         // easy, medium, hard, or null for mixed
    questionCount = 20,
    testType = 'practice',     // practice, timed, topic-wise
    timeLimitMinutes = null
  } = options;

  // Build filter
  const filter = {};
  if (category && category !== 'mixed') filter.category = category;
  if (topic) filter.topic = topic;
  if (difficulty) filter.difficulty = difficulty;

  // Adaptive: check user's weak topics from past attempts
  let weakTopics = [];
  if (!topic) {
    try {
      weakTopics = await getWeakTopics(userId);
    } catch (err) {
      console.warn('Could not fetch weak topics:', err.message);
    }
  }

  let questions = [];

  if (weakTopics.length > 0 && !topic) {
    // 40% from weak topics, 60% general
    const weakCount = Math.floor(questionCount * 0.4);
    const generalCount = questionCount - weakCount;

    const weakQs = await AptitudeQuestion.aggregate([
      { $match: { ...filter, topic: { $in: weakTopics } } },
      { $sample: { size: weakCount } }
    ]);

    const generalQs = await AptitudeQuestion.aggregate([
      { $match: { ...filter, topic: { $nin: weakTopics } } },
      { $sample: { size: generalCount } }
    ]);

    questions = [...weakQs, ...generalQs];
  } else {
    questions = await AptitudeQuestion.aggregate([
      { $match: filter },
      { $sample: { size: questionCount } }
    ]);
  }

  // If not enough questions, relax filters
  if (questions.length < questionCount) {
    const moreNeeded = questionCount - questions.length;
    const existingIds = questions.map(q => q._id);
    const more = await AptitudeQuestion.aggregate([
      { $match: { _id: { $nin: existingIds } } },
      { $sample: { size: moreNeeded } }
    ]);
    questions = [...questions, ...more];
  }

  // Shuffle
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  // Create attempt record
  const attempt = new AptitudeAttempt({
    userId,
    testType,
    category,
    topics: [...new Set(questions.map(q => q.topic))],
    questions: questions.map(q => ({
      questionId: q._id,
      selectedAnswer: null,
      isCorrect: null,
      timeSpentSeconds: 0,
      skipped: true
    })),
    totalQuestions: questions.length,
    timeLimitMinutes,
    status: 'in-progress'
  });

  await attempt.save();

  return {
    attemptId: attempt._id,
    testType,
    timeLimitMinutes,
    totalQuestions: questions.length,
    questions: questions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      options: q.options,
      topic: q.topic,
      category: q.category,
      difficulty: q.difficulty,
      // Don't expose: correctAnswer, explanation, shortcutMethod
    }))
  };
}

/**
 * Submit answers for a test and calculate results.
 */
async function submitTest(attemptId, answers) {
  const attempt = await AptitudeAttempt.findById(attemptId);
  if (!attempt) throw new Error('Attempt not found');
  if (attempt.status === 'completed') throw new Error('Test already submitted');

  // Fetch all question details for scoring
  const questionIds = attempt.questions.map(q => q.questionId);
  const questions = await AptitudeQuestion.find({ _id: { $in: questionIds } });
  const questionMap = {};
  questions.forEach(q => { questionMap[q._id.toString()] = q; });

  let correctCount = 0;
  const topicStats = {};

  // Process each answer
  for (const q of attempt.questions) {
    const answer = answers.find(a => a.questionId === q.questionId.toString());
    const question = questionMap[q.questionId.toString()];

    if (answer && answer.selectedAnswer !== null && answer.selectedAnswer !== undefined) {
      q.selectedAnswer = answer.selectedAnswer;
      q.isCorrect = answer.selectedAnswer === question.correctAnswer;
      q.timeSpentSeconds = answer.timeSpentSeconds || 0;
      q.skipped = false;

      // Update question stats
      question.timesAttempted = (question.timesAttempted || 0) + 1;
      if (q.isCorrect) {
        question.timesCorrect = (question.timesCorrect || 0) + 1;
        correctCount++;
      }
      await question.save();
    }

    // Topic breakdown
    const topic = question?.topic || 'unknown';
    if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
    topicStats[topic].total++;
    if (q.isCorrect) topicStats[topic].correct++;
  }

  // Calculate metrics
  const totalTime = attempt.questions.reduce((sum, q) => sum + (q.timeSpentSeconds || 0), 0);
  const answeredCount = attempt.questions.filter(q => !q.skipped).length;

  attempt.score = correctCount;
  attempt.percentage = attempt.totalQuestions > 0
    ? Math.round((correctCount / attempt.totalQuestions) * 100)
    : 0;
  attempt.totalTimeSeconds = totalTime;
  attempt.averageTimePerQuestion = answeredCount > 0
    ? Math.round(totalTime / answeredCount)
    : 0;
  attempt.topicBreakdown = Object.entries(topicStats).map(([topic, stats]) => ({
    topic,
    correct: stats.correct,
    total: stats.total,
    percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
  }));
  attempt.status = 'completed';
  attempt.completedAt = new Date();

  await attempt.save();

  // Fetch full question details for review
  const reviewQuestions = attempt.questions.map(q => {
    const question = questionMap[q.questionId.toString()];
    return {
      questionText: question?.questionText,
      options: question?.options,
      correctAnswer: question?.correctAnswer,
      selectedAnswer: q.selectedAnswer,
      isCorrect: q.isCorrect,
      skipped: q.skipped,
      timeSpentSeconds: q.timeSpentSeconds,
      explanation: question?.explanation,
      shortcutMethod: question?.shortcutMethod,
      topic: question?.topic,
      difficulty: question?.difficulty
    };
  });

  return {
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    percentage: attempt.percentage,
    totalTimeSeconds: attempt.totalTimeSeconds,
    averageTimePerQuestion: attempt.averageTimePerQuestion,
    topicBreakdown: attempt.topicBreakdown,
    questions: reviewQuestions
  };
}

/**
 * Get the user's weak topics based on past attempts.
 */
async function getWeakTopics(userId) {
  const recentAttempts = await AptitudeAttempt.find({
    userId,
    status: 'completed'
  }).sort({ completedAt: -1 }).limit(10);

  if (recentAttempts.length === 0) return [];

  const topicAgg = {};
  for (const attempt of recentAttempts) {
    for (const tb of (attempt.topicBreakdown || [])) {
      if (!topicAgg[tb.topic]) topicAgg[tb.topic] = { correct: 0, total: 0 };
      topicAgg[tb.topic].correct += tb.correct;
      topicAgg[tb.topic].total += tb.total;
    }
  }

  // Topics with < 60% accuracy are "weak"
  return Object.entries(topicAgg)
    .filter(([, stats]) => stats.total >= 3 && (stats.correct / stats.total) < 0.6)
    .map(([topic]) => topic);
}

/**
 * Get user's aptitude analytics.
 */
async function getUserAnalytics(userId) {
  const attempts = await AptitudeAttempt.find({
    userId,
    status: 'completed'
  }).sort({ completedAt: -1 });

  if (attempts.length === 0) {
    return { totalTests: 0, averageScore: 0, topicBreakdown: [], recentScores: [], weakTopics: [] };
  }

  const totalTests = attempts.length;
  const averageScore = Math.round(
    attempts.reduce((sum, a) => sum + a.percentage, 0) / totalTests
  );

  // Aggregate topic breakdown across all attempts
  const topicAgg = {};
  for (const attempt of attempts) {
    for (const tb of (attempt.topicBreakdown || [])) {
      if (!topicAgg[tb.topic]) topicAgg[tb.topic] = { correct: 0, total: 0 };
      topicAgg[tb.topic].correct += tb.correct;
      topicAgg[tb.topic].total += tb.total;
    }
  }

  const topicBreakdown = Object.entries(topicAgg)
    .map(([topic, stats]) => ({
      topic,
      correct: stats.correct,
      total: stats.total,
      percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    }))
    .sort((a, b) => a.percentage - b.percentage);

  const recentScores = attempts.slice(0, 10).map(a => ({
    date: a.completedAt,
    percentage: a.percentage,
    testType: a.testType,
    category: a.category
  }));

  const weakTopics = await getWeakTopics(userId);

  return { totalTests, averageScore, topicBreakdown, recentScores, weakTopics };
}

/**
 * Get available topics and their question counts.
 */
async function getTopics() {
  const topics = await AptitudeQuestion.aggregate([
    { $group: { _id: { topic: '$topic', category: '$category' }, count: { $sum: 1 } } },
    { $sort: { '_id.category': 1, '_id.topic': 1 } }
  ]);

  return topics.map(t => ({
    topic: t._id.topic,
    category: t._id.category,
    questionCount: t.count
  }));
}

module.exports = { generateTest, submitTest, getWeakTopics, getUserAnalytics, getTopics };
