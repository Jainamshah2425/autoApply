// services/aptitudeService.js
// Handles test generation, scoring, adaptive difficulty, and analytics.

const AptitudeQuestion = require('../models/AptitudeQuestion.js');
const AptitudeAttempt = require('../models/AptitudeAttempt.js');
const { getLLMResponse } = require('./llm.js');

// ─── Topic definitions for LLM generation ─────────────────────
const TOPIC_MAP = {
  quantitative: ['percentages', 'profit-loss', 'time-work', 'speed-time-distance', 'ratios', 'interest', 'number-series', 'probability', 'permutation-combination', 'averages'],
  logical: ['syllogisms', 'blood-relations', 'coding-decoding', 'seating-arrangement', 'pattern-recognition', 'data-sufficiency'],
  verbal: ['reading-comprehension', 'sentence-correction', 'analogies', 'fill-in-blanks', 'para-jumbles']
};

/**
 * Generate questions dynamically via LLM.
 * Returns an array of question objects matching the AptitudeQuestion schema.
 */
async function generateDynamicQuestions(category, topic, difficulty, count) {
  const topicList = topic
    ? [topic]
    : (category && category !== 'mixed')
      ? TOPIC_MAP[category] || []
      : [...TOPIC_MAP.quantitative, ...TOPIC_MAP.logical, ...TOPIC_MAP.verbal];

  const topicStr = topicList.join(', ');
  const diffStr = difficulty || 'mixed (easy, medium, hard)';
  const catStr = (category && category !== 'mixed') ? category : 'mixed (quantitative, logical, verbal)';

  const prompt = `You are an expert placement test question generator for Indian engineering placements (TCS, Infosys, Wipro, Cognizant, Capgemini, Accenture).

Generate EXACTLY ${count} unique multiple-choice questions.

Category: ${catStr}
Topics to cover: ${topicStr}
Difficulty: ${diffStr}

RULES:
- Each question must have EXACTLY 4 options
- Vary the topics — don't repeat the same topic consecutively
- Make questions DIFFERENT from standard textbook questions — use creative numbers and scenarios
- Include a clear explanation for each answer
- Include a shortcut method where applicable
- Assign realistic company tags

Return ONLY a valid JSON array in this exact format:
[
  {
    "questionText": "The question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Step-by-step solution",
    "shortcutMethod": "Quick trick if any, or null",
    "topic": "topic-name-in-kebab-case",
    "category": "quantitative|logical|verbal",
    "difficulty": "easy|medium|hard",
    "companyTags": ["TCS", "Infosys"],
    "averageTimeSeconds": 45
  }
]

Return ONLY the JSON array. No markdown, no code blocks, no extra text.`;

  try {
    const response = await getLLMResponse(prompt);
    let parsed;

    // Try direct parse
    try {
      parsed = JSON.parse(response.trim());
    } catch {
      // Extract JSON array from response
      const match = response.match(/\[[\s\S]*\]/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('LLM returned invalid format');
    }

    // Validate and sanitize each question
    return parsed
      .filter(q => q.questionText && Array.isArray(q.options) && q.options.length >= 2 && typeof q.correctAnswer === 'number')
      .map(q => ({
        questionText: q.questionText,
        options: q.options.slice(0, 4),
        correctAnswer: Math.min(q.correctAnswer, q.options.length - 1),
        explanation: q.explanation || 'No explanation provided',
        shortcutMethod: q.shortcutMethod || null,
        topic: q.topic || 'general',
        category: q.category || category || 'quantitative',
        difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
        companyTags: q.companyTags || [],
        averageTimeSeconds: q.averageTimeSeconds || 60,
        _isDynamic: true  // flag to identify LLM-generated questions
      }));
  } catch (err) {
    console.error('Dynamic question generation failed:', err.message);
    return []; // fallback to static bank
  }
}

/**
 * Get question IDs the user has already seen in recent attempts.
 */
async function getSeenQuestionIds(userId) {
  const recentAttempts = await AptitudeAttempt.find({ userId })
    .sort({ createdAt: -1 })
    .limit(15)  // look at last 15 tests
    .select('questions.questionId');

  const seenIds = new Set();
  for (const attempt of recentAttempts) {
    for (const q of (attempt.questions || [])) {
      if (q.questionId) seenIds.add(q.questionId.toString());
    }
  }
  return [...seenIds];
}

/**
 * Generate a test: LLM-dynamic questions first, fallback to unseen static questions.
 */
async function generateTest(userId, options = {}) {
  const {
    category = 'mixed',
    topic = null,
    difficulty = null,
    questionCount = 20,
    testType = 'practice',
    timeLimitMinutes = null
  } = options;

  console.log(`📝 Generating ${testType} test: ${questionCount} questions, category=${category}, topic=${topic}`);

  // Step 1: Try to generate dynamic questions via LLM
  let dynamicQuestions = [];
  try {
    dynamicQuestions = await generateDynamicQuestions(category, topic, difficulty, questionCount);
    console.log(`🤖 LLM generated ${dynamicQuestions.length} dynamic questions`);
  } catch (err) {
    console.warn('LLM generation failed, falling back to static bank:', err.message);
  }

  // Step 2: If we have enough dynamic questions, save them to DB and use them
  let questions = [];

  if (dynamicQuestions.length >= questionCount) {
    // Save dynamic questions to DB for persistence and future re-use
    const savedDocs = await AptitudeQuestion.insertMany(
      dynamicQuestions.map(q => {
        const { _isDynamic, ...rest } = q;
        return rest;
      })
    );
    questions = savedDocs.map(doc => doc.toObject());
    console.log(`💾 Saved ${savedDocs.length} new questions to DB`);

  } else {
    // Step 3: Supplement with unseen static questions
    const seenIds = await getSeenQuestionIds(userId);
    const seenObjectIds = seenIds.map(id => {
      try { return new (require('mongoose').Types.ObjectId)(id); } catch { return null; }
    }).filter(Boolean);

    const filter = {};
    if (category && category !== 'mixed') filter.category = category;
    if (topic) filter.topic = topic;
    if (difficulty) filter.difficulty = difficulty;
    if (seenObjectIds.length > 0) filter._id = { $nin: seenObjectIds };

    // Get unseen questions from static bank
    const staticQuestions = await AptitudeQuestion.aggregate([
      { $match: filter },
      { $sample: { size: questionCount - dynamicQuestions.length } }
    ]);

    // If still not enough (user has seen everything), reset and allow re-use
    if (staticQuestions.length + dynamicQuestions.length < questionCount) {
      console.log('User has seen most questions — allowing some repeats');
      const { _id, ...filterWithoutId } = filter;
      const moreQs = await AptitudeQuestion.aggregate([
        { $match: filterWithoutId },
        { $sample: { size: questionCount - staticQuestions.length - dynamicQuestions.length } }
      ]);
      staticQuestions.push(...moreQs);
    }

    // If we got dynamic questions, save them to DB first
    if (dynamicQuestions.length > 0) {
      const savedDynamic = await AptitudeQuestion.insertMany(
        dynamicQuestions.map(q => { const { _isDynamic, ...rest } = q; return rest; })
      );
      questions = [...savedDynamic.map(d => d.toObject()), ...staticQuestions];
    } else {
      questions = staticQuestions;
    }
  }

  // Shuffle
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  if (questions.length === 0) {
    throw new Error('No questions available. Please seed the question bank first.');
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

  console.log(`✅ Test generated: ${questions.length} questions (attempt ${attempt._id})`);

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
