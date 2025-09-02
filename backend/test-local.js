const axios = require('axios');

async function testLocalBackend() {
  try {
    console.log('Testing local backend...');
    const response = await axios.get('http://localhost:5000');
    console.log('✅ Success:', response.data);
    
    // Test interview endpoint
    const interviewTest = await axios.get('http://localhost:5000/api/interview/analyze-video');
    console.log('✅ Interview endpoint:', interviewTest.status);
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

testLocalBackend();
