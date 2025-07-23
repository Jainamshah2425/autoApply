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
    
    if (!resume) {
      console.error('ERROR: Resume not found for user:', userId);
      throw new Error('Resume not found for this user.');
    }
    
    console.log('Resume found:', {
      id: resume._id,
      textLength: resume.text?.length,
      createdAt: resume.createdAt
    });

    // 2. Construct the prompt for the LLM
    const prompt = `
      You are an expert interview coach. Based on the following resume and job description, 
      generate 15 insightful interview questions that will effectively assess the candidate's 
      suitability for the role, generate 3-behavioural and rest technical.

      **User's Resume:**
      ${resume.text}

      **Job Description:**
      ${jobDescription}

      **Instructions:**
      - Create questions that directly relate to the job requirements
      - Include both behavioral (STAR method) and technical questions
      - Ensure questions allow the candidate to showcase relevant experience
      - Make questions specific and actionable
      - Return ONLY a JSON array of strings, no additional text

      **Generated Questions:**
    `;

    console.log('Sending prompt to LLM, prompt length:', prompt.length);

    // 3. Get the response from the LLM
    const response = await getLLMResponse(prompt);
    console.log("=== LLM RESPONSE ===");
    console.log("Raw LLM response length:", response?.length);
    console.log("Raw LLM response preview:", response?.substring(0, 200));
    console.log("Raw LLM response (full):", response);

    // 4. Parse the questions with enhanced error handling
    let questions;
    
    if (!response || response.trim() === '') {
      console.error('ERROR: Empty response from LLM');
      throw new Error('Empty response from AI service');
    }
    
    try {
      console.log('Attempting to parse entire response as JSON...');
      // Attempt to parse the entire response as JSON
      questions = JSON.parse(response.trim());
      console.log('SUCCESS: Parsed entire response as JSON');
      console.log('Parsed questions:', questions);
    } catch (e) {
      console.log('Failed to parse entire response, trying to extract JSON from code block...');
      console.error('Parse error:', e.message);
      
      // If parsing fails, try to extract JSON from a code block
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/s);
      if (jsonMatch && jsonMatch[1]) {
        console.log('Found JSON in code block:', jsonMatch[1]);
        try {
          questions = JSON.parse(jsonMatch[1]);
          console.log('SUCCESS: Parsed JSON from code block');
          console.log('Parsed questions:', questions);
        } catch (error) {
          console.error("Failed to parse JSON from code block:", error.message);
          console.error("JSON content:", jsonMatch[1]);
          
          // Fallback questions
          questions = [
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
          console.log('Using fallback questions due to parsing error');
        }
      } else {
        console.error("No JSON found in LLM response");
        console.error("Response content:", response);
        
        // Try to extract array-like content manually
        const arrayMatch = response.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          console.log('Found array-like content:', arrayMatch[0]);
          try {
            questions = JSON.parse(arrayMatch[0]);
            console.log('SUCCESS: Parsed array content');
          } catch (err) {
            console.error('Failed to parse array content:', err.message);
            // Fallback questions
            questions = [
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
            console.log('Using fallback questions due to array parsing error');
          }
        } else {
          // Final fallback questions
          questions = [
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
          console.log('Using final fallback questions');
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

    // 5. Create interview session
    const sessionId = uuidv4();
    console.log('Creating interview session with ID:', sessionId);
    
    const interviewSession = new InterviewSession({
      sessionId,
      user: userId,
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

    console.log('Saving interview session...');
    const savedSession = await interviewSession.save();
    console.log('Session saved successfully:', savedSession._id);

    const result = { questions, sessionId };
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

    // 2. Get the response from the LLM
    const response = await getLLMResponse(prompt);
    
    // 3. Parse the analysis
    let analysis;
    try {
      analysis = JSON.parse(response);
    } catch (error) {
      console.error("Failed to parse LLM response for analysis:", error);
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

    return analysis;
  } catch (error) {
    console.error("Error analyzing answer:", error);
    throw error;
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
    const session = await InterviewSession.findOne({ sessionId });
    if (!session) {
      throw new Error('Session not found');
    }

    // Calculate session metrics
    const totalQuestions = session.questions.length;
    const completedQuestions = session.responses.length;
    const completionRate = (completedQuestions / totalQuestions) * 100;
    
    const scores = session.responses.map(r => r.analysis.overallScore);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    const sessionStart = session.createdAt;
    const sessionEnd = new Date();
    const totalDuration = (sessionEnd - sessionStart) / 1000 / 60; // minutes

    // Generate comprehensive insights
    const insights = await generateSessionInsights(session, {
      totalDuration,
      averageScore,
      completionRate,
      totalQuestions,
      completedQuestions
    });

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
        "confidence": 7
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
          "category": "behavioral",
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
        confidence: Math.round(metrics.averageScore)
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
        category: "behavioral",
        strengths: r.analysis.strengths,
        improvements: r.analysis.improvements
      })),
      recommendations: [
        "Practice the STAR method for behavioral questions",
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