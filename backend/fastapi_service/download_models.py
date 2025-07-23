import requests
import os

def download_file(url, dir_path, file_name):
    """Downloads a file from a URL."""
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, file_name)
    
    if os.path.exists(file_path):
        print(f"{file_name} already exists. Skipping download.")
        return

    print(f"Downloading {file_name}...")
    try:
        r = requests.get(url, stream=True)
        r.raise_for_status()
        with open(file_path, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        print("File downloaded successfully.")

    except requests.exceptions.RequestException as e:
        print(f"Error downloading file: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")


if __name__ == "__main__":
    # Emotion detection model
    emotion_model_url = "https://storage.googleapis.com/onnx_models/vision/body_analysis/emotion_ferplus/model/emotion-ferplus-8.onnx"
    emotion_model_dir = "models"
    emotion_model_name = "emotion-ferplus-8.onnx"

    download_file(emotion_model_url, emotion_model_dir, emotion_model_name)