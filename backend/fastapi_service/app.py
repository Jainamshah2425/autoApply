#!/usr/bin/env python3
"""
Entry point for Hugging Face Spaces deployment.
This file ensures compatibility with Hugging Face Spaces requirements.
"""

import os
import sys
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Main entry point for the application"""
    try:
        logger.info("🚀 Starting Interview Analysis API...")
        logger.info(f"Python version: {sys.version}")
        logger.info(f"Working directory: {os.getcwd()}")
        
        # Import and run the main application
        from main import app
        import uvicorn
        
        # Get port from environment (Hugging Face Spaces uses 7860)
        port = int(os.environ.get("PORT", 7860))
        host = os.environ.get("HOST", "0.0.0.0")
        
        logger.info(f"🌐 Starting server on {host}:{port}")
        
        # Start the server
        uvicorn.run(
            app, 
            host=host, 
            port=port, 
            log_level="info",
            access_log=True
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to start application: {e}")
        raise

if __name__ == "__main__":
    main()
