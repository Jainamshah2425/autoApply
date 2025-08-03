// Health check for FastAPI service before starting backend
const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get FastAPI URL from environment
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const MAX_RETRY = 3;
const RETRY_INTERVAL = 2000; // 2 seconds

console.log('Checking FastAPI service...');
console.log(`Using FastAPI URL: ${FASTAPI_URL}`);

function checkService(retry = 0) {
  if (retry >= MAX_RETRY) {
    console.error('FastAPI service is not running. Please start it first.');
    console.log('You can run the FastAPI service with:');
    console.log('  cd fastapi_service');
    console.log('  start_service.bat');
    process.exit(1);
  }

  const url = new URL('/health', FASTAPI_URL);
  
  http.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const parsedData = JSON.parse(data);
          if (parsedData.status === 'healthy') {
            console.log('✅ FastAPI service is running correctly.');
            process.exit(0);
          } else {
            console.warn('⚠️ FastAPI service reports it is unhealthy.');
            console.log(parsedData);
            setTimeout(() => checkService(retry + 1), RETRY_INTERVAL);
          }
        } catch (e) {
          console.error('Error parsing health check response:', e);
          setTimeout(() => checkService(retry + 1), RETRY_INTERVAL);
        }
      } else {
        console.warn(`⚠️ Health check returned status ${res.statusCode}`);
        setTimeout(() => checkService(retry + 1), RETRY_INTERVAL);
      }
    });
  }).on('error', (err) => {
    console.warn(`⚠️ Error connecting to FastAPI service: ${err.message}`);
    setTimeout(() => checkService(retry + 1), RETRY_INTERVAL);
  });
}

// Start the check
checkService();
