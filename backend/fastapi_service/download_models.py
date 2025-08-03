import requests
import os
import sys
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('download_models.log')
    ]
)

logger = logging.getLogger(__name__)

def download_file(url, dir_path, file_name):
    """Downloads a file from a URL."""
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, file_name)
    
    if os.path.exists(file_path):
        logger.info(f"{file_name} already exists. Skipping download.")
        return

    logger.info(f"Downloading {file_name}...")
    try:
        r = requests.get(url, stream=True)
        r.raise_for_status()
        with open(file_path, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        logger.info(f"File downloaded successfully to {file_path}")

    except requests.exceptions.RequestException as e:
        logger.error(f"Error downloading file: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred: {e}")


if __name__ == "__main__":
    # No models needed for basic transcription service
    # This script is kept for future expansion
    logger.info("No models are required for the transcription service. This script is kept for future use.")