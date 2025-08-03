// test_llm.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { generateImprovedAnswer } = require('./services/llm');

async function testGenerateImprovedAnswer() {
  try {
    console.log('Starting test...');
    console.log('GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);
    
    const result = await generateImprovedAnswer({
      question: 'Tell me about yourself',
      userAnswer: 'I have experience in software development and I am looking for new opportunities.'
    });
    
    console.log('Result:', result);
  } catch(e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

testGenerateImprovedAnswer();
