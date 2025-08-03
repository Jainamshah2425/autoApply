// test_endpoint.js
const axios = require('axios');

async function testEndpoint() {
  try {
    console.log('Testing LLM endpoint...');
    const response = await axios.post('http://localhost:5000/api/llm/generate-improved-answer', {
      question: 'Tell me about yourself',
      userAnswer: 'I have experience in software development and I am looking for new opportunities.'
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testEndpoint();
