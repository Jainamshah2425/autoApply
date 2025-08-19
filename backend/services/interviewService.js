const User = require('../models/User');
const Resume = require('../models/Resume');
const InterviewSession = require('../models/InterviewSession');
const { getLLMResponse } = require('./llm.js');
const { v4: uuidv4 } = require('uuid');



/**
 * Generates interview questons based on a job description and user's resume.
 */
// Replace your generateQuestions function in interviewService.js with this enhanced version:

async function generateQuestions(jobDescription, userId) {
  console.log('=== BACKEND: generateQuestions STARTED ===');
  console.log('Job Description Length:', jobDescription?.length);
  console.log('User ID:', userId);
  
  try {
    // 1. Fetch the user's most recent resume
    console.log('Fetching resume for user:', userId);
    const resume = await Resume.findOne({ user: userId }).sort({ createdAt: -1 });
    let resumeText = '';
    if (!resume) {
      console.warn('WARN: Resume not found for user; proceeding without resume context:', userId);
    } else {
      resumeText = resume.text || '';
      console.log('Resume found:', {
        id: resume._id,
        textLength: resumeText.length,
        createdAt: resume.createdAt
      });
    }

    // 2. Construct the prompt for the LLM
    const prompt = `
      You are an expert interview coach. Based on the following resume and job description, 
      generate 15 insightful interview questions that will effectively assess the candidate's 
      suitability for the role, generate 3-technical and rest mixed type questions.

      **User's Resume:**
      ${resumeText}

      **Job Description:**
      ${jobDescription}

      **Instructions:**
      - Create questions that directly relate to the job requirements
      - Include both technical and general interview questions
      - Ensure questions allow the candidate to showcase relevant experience
      - Make questions specific and actionable
      - Return ONLY a JSON array of strings, no additional text

      **Generated Questions:**
    `;

    console.log('Sending prompt to LLM, prompt length:', prompt.length);

    // 3. Get the response from the LLM (with graceful fallback)
    let response = null;
    const fallbackQuestions = [
      "Tell me about yourself.",
      "What are your strengths and weaknesses?",
      "Why are you interested in this role?",
      "Describe a challenging situation you've faced at work and how you handled it.",
      "Where do you see yourself in 5 years?",
      "What specific skills do you bring to this position?",
      "How do you handle tight deadlines?",
      "Describe a time when you had to work with a difficult team member.",
      "What motivates you in your work?",
      "How do you stay updated with industry trends?",
      "Describe a project you're particularly proud of.",
      "How do you handle feedback and criticism?",
      "What would you do in your first 90 days in this role?",
      "Describe a time when you had to learn something new quickly.",
      "How do you prioritize your work when you have multiple deadlines?"
    ];
    try {
      response = await getLLMResponse(prompt);
      console.log("=== LLM RESPONSE ===");
      console.log("Raw LLM response length:", response?.length);
      console.log("Raw LLM response preview:", response?.substring(0, 200));
    } catch (apiErr) {
      console.error('LLM call failed, using fallback questions:', apiErr?.message);
    }

    // 4. Parse the questions with enhanced error handling
    let questions;
    if (!response || response.trim() === '') {
      console.warn('LLM response empty or unavailable; using fallback questions');
      questions = fallbackQuestions;
    } else {
      try {
        console.log('Attempting to parse entire response as JSON...');
        questions = JSON.parse(response.trim());
        console.log('SUCCESS: Parsed entire response as JSON');
      } catch (e) {
        console.log('Failed to parse entire response, trying to extract JSON from code block...');
        console.error('Parse error:', e.message);
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/s);
        if (jsonMatch && jsonMatch[1]) {
          try {
            questions = JSON.parse(jsonMatch[1]);
            console.log('SUCCESS: Parsed JSON from code block');
          } catch (error) {
            console.error('Failed to parse JSON from code block:', error.message);
            questions = fallbackQuestions;
            console.log('Using fallback questions due to parsing error');
          }
        } else {
          console.error('No JSON found in LLM response');
          const arrayMatch = response.match(/\[[\s\S]*\]/);
          if (arrayMatch) {
            try {
              questions = JSON.parse(arrayMatch[0]);
              console.log('SUCCESS: Parsed array content');
            } catch (err) {
              console.error('Failed to parse array content:', err.message);
              questions = fallbackQuestions;
              console.log('Using fallback questions due to array parsing error');
            }
          } else {
            questions = fallbackQuestions;
            console.log('Using final fallback questions');
          }
        }
      }
    }

    // Validate the questions array
    if (!Array.isArray(questions)) {
      console.error('ERROR: Questions is not an array:', typeof questions, questions);
      throw new Error('Invalid questions format from AI service');
    }
    
    if (questions.length === 0) {
      console.error('ERROR: Empty questions array');
      throw new Error('No questions generated by AI service');
    }
    
    // Ensure all questions are strings
    questions = questions.map((q, index) => {
      if (typeof q !== 'string') {
        console.warn(`Question ${index} is not a string:`, q);
        return String(q);
      }
      return q.trim();
    }).filter(q => q.length > 0);
    
    console.log('=== FINAL QUESTIONS ===');
    console.log('Questions count:', questions.length);
    console.log('Questions array:', questions);

    // 5. Create interview session (robust to DB failures)
    let sessionId = uuidv4();
    console.log('Creating interview session with ID:', sessionId);
    console.log('UserId:', userId, 'Type:', typeof userId);

    const interviewSession = new InterviewSession({
      sessionId,
      userId: userId, // Add userId field
      user: userId,   // Keep user field for backward compatibility
      jobDescription,
      questions: questions,
      responses: [],
      sessionMetrics: {
        totalDuration: 0,
        averageScore: 0,
        completionRate: 0
      },
      status: 'active'
    });

    let persisted = true;
    try {
      console.log('Saving interview session...');
      console.log('Session before save:', { 
        sessionId: interviewSession.sessionId, 
        userId: interviewSession.userId,
        user: interviewSession.user,
        questionsCount: interviewSession.questions.length
      });
      
      // Validate required fields before saving
      if (!interviewSession.sessionId) {
        throw new Error('SessionId is required');
      }
      if (!interviewSession.userId && !interviewSession.user) {
        throw new Error('UserId is required');
      }
      if (!interviewSession.jobDescription) {
        throw new Error('Job description is required');
      }
      
      const savedSession = await interviewSession.save();
      console.log('✅ Session saved successfully:', savedSession._id);
      console.log('Saved session details:', {
        sessionId: savedSession.sessionId,
        userId: savedSession.userId,
        user: savedSession.user
      });
      
      // Verify the session was actually saved by trying to find it
      const verifySession = await InterviewSession.findOne({ sessionId: savedSession.sessionId });
      if (!verifySession) {
        throw new Error('Session save verification failed - session not found after save');
      }
      console.log('✅ Session save verification passed');
      
    } catch (dbErr) {
      console.error('❌ Failed to persist session to DB:', dbErr?.message);
      console.error('Full error details:', {
        name: dbErr?.name,
        message: dbErr?.message,
        code: dbErr?.code,
        codeName: dbErr?.codeName
      });
      
      // Additional validation error details
      if (dbErr.name === 'ValidationError' && dbErr.errors) {
        console.error('Validation errors:');
        Object.keys(dbErr.errors).forEach(field => {
          console.error(`- ${field}: ${dbErr.errors[field].message}`);
        });
      }
      
      persisted = false;
      // Keep session usable in-memory for the client; generate a temporary id to avoid collision
      const originalSessionId = sessionId;
      sessionId = `temp-${sessionId}`;
      console.log(`Changed sessionId from ${originalSessionId} to temporary: ${sessionId}`);
    }

    const result = { questions, sessionId, persisted };
    console.log('=== RETURNING RESULT ===');
    console.log('Result:', result);
    console.log('=== BACKEND: generateQuestions COMPLETED ===');
    
    return result;
  } catch (error) {
    console.error("=== BACKEND ERROR ===");
    console.error("Error generating questions:", error);
    console.error("Error stack:", error.stack);
    throw error;
  }
}

/**
 * Analyzes a user's answer to an interview question with comprehensive feedback.
 */
async function analyzeAnswer(question, answer, audioMetrics = null, sessionId, questionIndex) {
  try {
    console.log('=== ANALYZE ANSWER SERVICE ===');
    console.log('Inputs:', {
      questionLength: question?.length,
      answerLength: answer?.length,
      hasAudioMetrics: !!audioMetrics,
      sessionId,
      questionIndex
    });

    // 1. Construct the comprehensive analysis prompt
    const prompt = `
      You are an expert interview coach. Analyze the following answer to an interview question 
      and provide detailed, constructive feedback across multiple dimensions.

      **Interview Question:**
      ${question}

      **Candidate's Answer:**
      ${answer}

      ${audioMetrics ? `
      **Audio Metrics:**
      - Duration: ${audioMetrics.duration} seconds
      - Words per minute: ${audioMetrics.wordsPerMinute}
      - Word count: ${audioMetrics.wordCount}
      ` : ''}

      **Analysis Requirements:**
      Provide a comprehensive analysis in the following JSON format:
      {
        "overallScore": 7,
        "contentScore": 8,
        "structureScore": 6,
        "communicationScore": 7,
        "confidenceScore": 7,
        "feedback": "Detailed feedback paragraph",
        "strengths": ["strength1", "strength2"],
        "improvements": ["improvement1", "improvement2"],
        "starMethod": {
          "situation": "present/missing",
          "task": "present/missing", 
          "action": "present/missing",
          "result": "present/missing",
          "score": 6
        },
        "keywordMatch": 8,
        "specificExamples": true,
        "recommendations": ["rec1", "rec2", "rec3"]
      }

      **Scoring Guide (1-10):**
      - Content Quality: Relevance, depth, accuracy
      - Structure: Organization, flow, STAR method usage
      - Communication: Clarity, pace, articulation
      - Confidence: Assertiveness, conviction
      - Overall: Holistic assessment

      Return ONLY the JSON object, no additional text.
    `;

    console.log('Calling LLM service...');
    
    // 2. Get the response from the LLM
    const response = await getLLMResponse(prompt);
    
    console.log('LLM response received, length:', response?.length);
    
    // 3. Parse the analysis
    let analysis;
    try {
      analysis = JSON.parse(response);
      console.log('Successfully parsed LLM response');
    } catch (parseError) {
      console.error("Failed to parse LLM response for analysis:", parseError);
      console.log('Raw LLM response:', response);
      
      // Fallback analysis
      analysis = {
        overallScore: 6,
        contentScore: 6,
        structureScore: 6,
        communicationScore: 6,
        confidenceScore: 6,
        feedback: "Your answer provides some relevant information. Consider providing more specific examples and structuring your response using the STAR method (Situation, Task, Action, Result) for better clarity.",
        strengths: ["Shows relevant experience", "Demonstrates understanding"],
        improvements: ["Add specific examples", "Improve structure", "Provide quantifiable results"],
        starMethod: {
          situation: "partial",
          task: "partial",
          action: "present",
          result: "missing",
          score: 5
        },
        keywordMatch: 6,
        specificExamples: answer.includes("example") || answer.includes("instance"),
        recommendations: [
          "Use the STAR method to structure your response",
          "Include specific, quantifiable examples",
          "Connect your experience directly to the job requirements"
        ]
      };
    }

    // 4. Save response to session
    if (sessionId) {
      console.log('Saving to session:', sessionId);
      await InterviewSession.findOneAndUpdate(
        { sessionId },
        {
          $push: {
            responses: {
              questionIndex,
              question,
              answer,
              audioMetrics,
              analysis,
              timestamp: new Date()
            }
          }
        }
      );
    }

    console.log('Analysis completed successfully');
    return analysis;
  } catch (error) {
    console.error("Error analyzing answer:", error);
    console.error("Error stack:", error.stack);
    
    // Return a fallback analysis instead of throwing
    return {
      overallScore: 5,
      contentScore: 5,
      structureScore: 5,
      communicationScore: 5,
      confidenceScore: 5,
      feedback: "Unable to complete full analysis due to technical issues. Your answer shows effort and thought. Consider providing more specific examples and clear structure in your responses.",
      strengths: ["Attempted to answer the question"],
      improvements: ["Add specific examples", "Improve clarity", "Use structured approach"],
      starMethod: {
        situation: "unknown",
        task: "unknown",
        action: "unknown",
        result: "unknown",
        score: 3
      },
      keywordMatch: 5,
      specificExamples: false,
      recommendations: [
        "Practice structuring your answers",
        "Include specific examples from your experience",
        "Try again once technical issues are resolved"
      ],
      error: "Analysis completed with limited functionality"
    };
  }
}

/**
 * Transcribes audio using Web Speech API (free) - client-side implementation
 * For server-side, we'll use a simple implementation that returns placeholder text
 */
async function transcribeAudio(audioBuffer) {
  // This is a placeholder function.
  // You can replace this with a real transcription service.
  return Promise.resolve('This is a dummy transcription.');
}

/**
 * Web Speech API transcription (client-side implementation)
 * This should be implemented on the frontend
 */
function getWebSpeechTranscription() {
  return `
    // Client-side implementation using Web Speech API
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      return finalTranscript;
    };
  `;
}

/**
 * Completes interview session and generates comprehensive insights
 */
async function completeSession(sessionId, userId, questionTimings) {
  try {
    console.log('=== COMPLETE SESSION SERVICE DEBUG ===');
    console.log('Looking for sessionId:', sessionId);
    console.log('SessionId type:', typeof sessionId);
    console.log('UserId:', userId);
    
    // Strategy 1: Try to find session with the provided sessionId
    let session = await InterviewSession.findOne({ sessionId });
    console.log('Strategy 1 - Direct sessionId lookup:', session ? 'FOUND' : 'NOT FOUND');
    
    // Strategy 2: If not found and sessionId starts with "temp-", try the original sessionId
    if (!session && sessionId && sessionId.startsWith('temp-')) {
      const originalSessionId = sessionId.replace('temp-', '');
      console.log('Strategy 2 - Trying original sessionId:', originalSessionId);
      session = await InterviewSession.findOne({ sessionId: originalSessionId });
      console.log('Strategy 2 result:', session ? 'FOUND' : 'NOT FOUND');
    }
    
    // Strategy 3: If still not found, try to find by userId for the most recent session
    if (!session && userId) {
      console.log('Strategy 3 - Finding most recent session for userId:', userId);
      try {
        // Convert userId to ObjectId if it's a string
        const userObjectId = typeof userId === 'string' ? new require('mongoose').Types.ObjectId(userId) : userId;
        session = await InterviewSession.findOne({ 
          $or: [
            { userId: userObjectId },
            { user: userObjectId }
          ]
        }).sort({ createdAt: -1 });
        console.log('Strategy 3 result:', session ? `FOUND (${session.sessionId})` : 'NOT FOUND');
      } catch (objectIdError) {
        console.log('Strategy 3 - ObjectId conversion failed:', objectIdError.message);
      }
    }
    
    // Strategy 4: Last resort - find any recent session
    if (!session) {
      console.log('Strategy 4 - Finding any recent session');
      session = await InterviewSession.findOne({}).sort({ createdAt: -1 });
      console.log('Strategy 4 result:', session ? `FOUND (${session.sessionId})` : 'NOT FOUND');
    }
    
    // If still not found, log debug info and throw error
    if (!session) {
      console.log('=== DEBUG INFO ===');
      const allSessions = await InterviewSession.find({}).limit(5).sort({ createdAt: -1 });
      console.log('Recent sessions in database:');
      allSessions.forEach(s => {
        console.log(`- SessionId: ${s.sessionId}, UserId: ${s.userId}, User: ${s.user}, Created: ${s.createdAt}`);
      });
      
      const sessionCount = await InterviewSession.countDocuments();
      console.log('Total sessions in database:', sessionCount);
      
      throw new Error(`Session not found. Searched for sessionId: ${sessionId}, userId: ${userId}`);
    }
    
    console.log('✅ Session found:', session.sessionId);
    console.log('Session userId:', session.userId);
    console.log('Session user:', session.user);

    // Calculate session metrics (with fallbacks for incomplete data)
    const totalQuestions = session.questions?.length || 0;
    const completedQuestions = session.responses?.length || 0;
    const completionRate = totalQuestions > 0 ? (completedQuestions / totalQuestions) * 100 : 0;
    
    // Handle cases where responses might not have analysis data
    const validResponses = session.responses?.filter(r => r.analysis && typeof r.analysis.overallScore === 'number') || [];
    const scores = validResponses.map(r => r.analysis.overallScore);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    const sessionStart = session.createdAt || new Date();
    const sessionEnd = new Date();
    const totalDuration = (sessionEnd - sessionStart) / 1000 / 60; // minutes

    console.log('Session metrics calculated:', {
      totalQuestions,
      completedQuestions,
      completionRate,
      averageScore,
      totalDuration
    });

    // Generate comprehensive insights (with fallback for when session is incomplete)
    let insights;
    try {
      insights = await generateSessionInsights(session, {
        totalDuration,
        averageScore,
        completionRate,
        totalQuestions,
        completedQuestions
      });
    } catch (insightsError) {
      console.log('Failed to generate full insights, creating fallback:', insightsError.message);
      insights = {
        overallAssessment: 'Session completed successfully. Full analysis may be incomplete due to missing data.',
        scores: {
          overall: averageScore,
          communication: averageScore,
          technical: averageScore,
          problemSolving: averageScore
        },
        strengths: ['Participated in interview session'],
        improvements: ['Continue practicing interview skills'],
        nextSteps: ['Review your responses and practice similar questions'],
        metrics: {
          totalDuration,
          averageScore,
          completionRate,
          totalQuestions,
          completedQuestions
        }
      };
    }

    // Update session
    await InterviewSession.findOneAndUpdate(
      { sessionId },
      {
        status: 'completed',
        sessionMetrics: {
          totalDuration,
          averageScore,
          completionRate
        },
        insights,
        completedAt: new Date()
      }
    );

    return { insights };
  } catch (error) {
    console.error("Error completing session:", error);
    throw error;
  }
}

/**
 * Generates comprehensive session insights
 */
async function generateSessionInsights(session, metrics) {
  const prompt = `
    You are an expert interview coach. Analyze this complete interview session and provide 
    comprehensive insights and recommendations.

    **Session Overview:**
    - Total Questions: ${metrics.totalQuestions}
    - Completed Questions: ${metrics.completedQuestions}
    - Completion Rate: ${metrics.completionRate}%
    - Average Score: ${metrics.averageScore}/10
    - Total Duration: ${metrics.totalDuration} minutes

    **Individual Responses:**
    ${session.responses.map((r, i) => `
    Question ${i + 1}: ${r.question}
    Answer: ${r.answer}
    Scores: Overall=${r.analysis.overallScore}, Content=${r.analysis.contentScore}, Structure=${r.analysis.structureScore}
    `).join('\n')}

    **Required Analysis (return as JSON):**
    {
      "overallAssessment": "Comprehensive paragraph assessment",
      "totalScore": 75,
      "categoryScores": {
        "content": 8,
        "structure": 6,
        "communication": 7,
        "technical": 7
      },
      "strengths": ["strength1", "strength2", "strength3"],
      "keyImprovements": ["improvement1", "improvement2", "improvement3"],
      "detailedFeedback": {
        "content": "Detailed content feedback",
        "structure": "Detailed structure feedback", 
        "communication": "Detailed communication feedback"
      },
      "questionAnalytics": [
        {
          "questionNumber": 1,
          "score": 8,
          "category": "technical",
          "strengths": ["strength1"],
          "improvements": ["improvement1"]
        }
      ],
      "recommendations": [
        "actionable recommendation 1",
        "actionable recommendation 2",
        "actionable recommendation 3"
      ],
      "nextSteps": "Paragraph with specific next steps"
    }

    Return ONLY the JSON object, no additional text.
  `;

  try {
    const response = await getLLMResponse(prompt);
    return JSON.parse(response);
  } catch (error) {
    console.error("Error generating session insights:", error);
    // Return fallback insights
    return {
      overallAssessment: "Your interview session showed good potential with room for improvement in structure and specific examples.",
      totalScore: Math.round(metrics.averageScore * 10),
      categoryScores: {
        content: Math.round(metrics.averageScore),
        structure: Math.round(metrics.averageScore - 1),
        communication: Math.round(metrics.averageScore),
        technical: Math.round(metrics.averageScore)
      },
      strengths: ["Shows relevant experience", "Demonstrates understanding", "Good communication skills"],
      keyImprovements: ["Use STAR method", "Provide specific examples", "Improve response structure"],
      detailedFeedback: {
        content: "Your responses show good understanding of the role requirements.",
        structure: "Consider using the STAR method for better organization.",
        communication: "Your communication is clear but could be more concise."
      },
      questionAnalytics: session.responses.map((r, i) => ({
        questionNumber: i + 1,
        score: r.analysis.overallScore,
        category: "technical",
        strengths: r.analysis.strengths,
        improvements: r.analysis.improvements
      })),
      recommendations: [
        "Practice structured problem-solving approaches",
        "Prepare specific examples with quantifiable results",
        "Work on response timing and conciseness"
      ],
      nextSteps: "Focus on practicing with the STAR method and preparing specific examples for common interview questions."
    };
  }
}

module.exports = {
  generateQuestions,
  analyzeAnswer,
  transcribeAudio,
  completeSession,
  generateSessionInsights
};