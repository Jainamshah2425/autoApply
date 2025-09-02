// test_llm.js - Updated to test fixed LLM model
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { generateImprovedAnswer, getLLMResponse } = require('./services/llm');

async function testLLMFix() {
  console.log('🧪 Testing LLM service with updated model...\n');
  
  try {
    console.log('📡 Testing simple prompt...');
    console.log('GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);
    
    const testPrompt = "What are the key skills for a software engineer?";
    
    console.log('Making LLM request...');
    const response = await getLLMResponse(testPrompt);
    
    console.log('✅ LLM test successful!');
    console.log('Response length:', response?.length);
    console.log('First 100 characters:', response?.substring(0, 100));
    
    // Test generateImprovedAnswer function
    console.log('\n🔄 Testing generateImprovedAnswer...');
    const improvedResult = await generateImprovedAnswer({
      question: 'Tell me about yourself',
      userAnswer: 'I have experience in software development and I am looking for new opportunities.'
    });
    
    console.log('✅ generateImprovedAnswer test successful!');
    console.log('Improved answer length:', improvedResult?.length);
    console.log('First 100 characters:', improvedResult?.substring(0, 100));
    
    return true;
  } catch (error) {
    console.log('❌ LLM test failed!');
    console.log('Error type:', error.constructor.name);
    console.log('Error message:', error.message);
    
    if (error.message.includes('decommissioned')) {
      console.log('🚨 Model still decommissioned - need to update to different model');
    } else if (error.message.includes('API_KEY')) {
      console.log('🔑 Missing or invalid GROQ API key');
    } else {
      console.log('🔍 Other error - check logs above');
    }
    
    return false;
  }
}

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

// Run the test
testLLMFix();
