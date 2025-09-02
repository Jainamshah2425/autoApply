const axios = require('axios');

/**
 * Gets a response from the LLM based on a given prompt.
 * @param {string} prompt - The prompt to send to the LLM.
 * @returns {Promise<string>} - A promise that resolves to the LLM's response.
 */
async function getLLMResponse(prompt) {
  const systemPrompt = `You are a helpful AI assistant.`; // A generic system prompt

  try {
    console.log('=== LLM SERVICE CALL ===');
    console.log('Prompt length:', prompt?.length);
    const hasKey = !!process.env.GROQ_API_KEY;
    console.log('API Key present:', hasKey);
    if (!hasKey) {
      throw new Error('Missing GROQ_API_KEY environment variable');
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'user', content: prompt },
        ],
        max_tokens: 1500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30 second timeout
      }
    );

    console.log('LLM API response status:', response.status);
    console.log('Response data structure:', {
      hasChoices: !!response.data.choices,
      choicesLength: response.data.choices?.length,
      hasMessage: !!response.data.choices?.[0]?.message,
      messageLength: response.data.choices?.[0]?.message?.content?.length
    });

  return response.data.choices[0].message.content;
  } catch (error) {
    console.error('=== LLM API ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      console.error('Request made but no response received');
      console.error('Request details:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    
  const reason = error.response?.data?.error?.message || error.message || 'Unknown LLM error';
  throw new Error(`LLM API failed: ${reason}`);
  }
}

/**
 * Generates an improved interview answer based on the user's original answer.
 * @param {Object} params - The parameters for generating the improved answer.
 * @param {string} params.question - The interview question.
 * @param {string} params.userAnswer - The user's original answer.
 * @param {string} params.jobDescription - The job description.
 * @param {string} params.resumeText - The user's resume text.
 * @returns {Promise<string>} - A promise that resolves to the improved answer.
 */
async function generateImprovedAnswer({ question, userAnswer, jobDescription = '', resumeText = '' }) {
  // Create a prompt that gives context and instructions for improving the answer
  const prompt = `
You are an expert interview coach with years of experience helping people land jobs at top companies.

INTERVIEW QUESTION: "${question}"

ORIGINAL ANSWER: "${userAnswer}"

${jobDescription ? `JOB DESCRIPTION: ${jobDescription}` : ''}

${resumeText ? `CANDIDATE RESUME: ${resumeText}` : ''}

Please create an improved version of the candidate's answer that:
1. Maintains their authentic voice and core points
2. Is structured with a clear beginning, middle, and end
3. Uses the STAR method (Situation, Task, Action, Result) for behavioral questions
4. Includes specific, quantifiable achievements where relevant
5. Aligns with the job requirements mentioned in the job description
6. Is concise and focused (aim for 30-60 seconds spoken length)
7. Demonstrates relevant skills and experience from their resume
8. Avoids filler words, hedging language, and overly technical jargon

FORMAT:
- Provide ONLY the improved answer without any explanations or notes
- Write in first-person as if the candidate is speaking
- Use natural, conversational language that sounds authentic when spoken aloud
`;

  try {
    const improvedAnswer = await getLLMResponse(prompt);
    return improvedAnswer;
  } catch (error) {
    console.error('Error generating improved answer:', error);
    throw new Error('Failed to generate improved answer.');
  }
}

module.exports = { getLLMResponse, generateImprovedAnswer };
