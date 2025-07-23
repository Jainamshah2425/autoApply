const axios = require('axios');

/**
 * Gets a response from the LLM based on a given prompt.
 * @param {string} prompt - The prompt to send to the LLM.
 * @returns {Promise<string>} - A promise that resolves to the LLM's response.
 */
async function getLLMResponse(prompt) {
  const systemPrompt = `You are a helpful AI assistant.`; // A generic system prompt

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-70b-8192',
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
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling LLM API:', error.response?.data || error.message);
    throw new Error('Failed to get response from LLM.');
  }
}

module.exports = { getLLMResponse };
