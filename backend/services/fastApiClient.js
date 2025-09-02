const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get FastAPI URL from environment - Updated for Hugging Face Spaces
const FASTAPI_URL = process.env.FASTAPI_URL || 'https://jainamshah2425-autoapply.hf.space';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

class FastApiClient {
  constructor() {
    this.baseUrl = FASTAPI_URL;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120000, // 2 minutes for video processing
      headers: {
        'User-Agent': 'AutoApply-Backend/1.0'
      }
    });
    
    console.log(`🚀 FastAPI client initialized with URL: ${this.baseUrl}`);
    
    // Test connection on initialization
    this.testConnection();
  }

  /**
   * Test connection to FastAPI service
   */
  async testConnection() {
    try {
      const response = await this.client.get('/health', { timeout: 10000 });
      console.log('✅ FastAPI connection successful:', response.data);
      return true;
    } catch (error) {
      console.error('❌ FastAPI connection failed:', error.message);
      return false;
    }
  }

  /**
   * Analyze a video file for transcription
   * @param {string} videoPath Path to the video file
   * @returns {Promise<Object>} Transcription and analysis results
   */
  async analyzeVideo(videoPath, retryCount = 0) {
    try {
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }

      const formData = new FormData();
      const videoStream = fs.createReadStream(videoPath);
      formData.append('video', videoStream);

      console.log(`Sending video file ${path.basename(videoPath)} to FastAPI service...`);
      console.log(`File size: ${(fs.statSync(videoPath).size / 1024 / 1024).toFixed(2)} MB`);

      const response = await this.client.post('/api/interview/analyze-video', formData, {
        headers: {
          ...formData.getHeaders(),
        }
      });
      
      console.log(`Video analysis completed successfully. Request ID: ${response.data.request_id}`);
      return response.data;
      return response.data;
    } catch (error) {
      // Log detailed error information
      console.error('Error in analyzeVideo:');
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error(`Status: ${error.response.status}`);
        console.error(`Headers: ${JSON.stringify(error.response.headers)}`);
        console.error(`Data: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received from FastAPI service');
        console.error(error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error(`Error message: ${error.message}`);
      }

      // Retry logic
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying (${retryCount + 1}/${MAX_RETRIES}) after ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.analyzeVideo(videoPath, retryCount + 1);
      }

      // After all retries fail, throw a more user-friendly error
      throw new Error(`Failed to analyze video after ${MAX_RETRIES} attempts: ${error.message}`);
    }
  }

  /**
   * Check if the FastAPI service is healthy
   * @returns {Promise<boolean>} True if service is healthy
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      console.error('Health check failed:', error.message);
      return false;
    }
  }
}

module.exports = new FastApiClient();
