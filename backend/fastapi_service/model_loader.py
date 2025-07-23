
import base64
import os

MODEL_DIR = "models"
MODEL_NAME = "emotion-ferplus-8.onnx"
MODEL_PATH = os.path.join(MODEL_DIR, MODEL_NAME)

# Placeholder for the base64 encoded model string
MODEL_BASE64 = ""

def load_model():
    """
    Decodes the base64 model and writes it to the filesystem if it doesn't exist.
    """
    if os.path.exists(MODEL_PATH):
        print(f"{MODEL_NAME} already exists. Skipping creation.")
        return

    print(f"Creating {MODEL_NAME} from embedded data...")
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    if not MODEL_BASE64:
        print("Error: Model data is missing from the script.")
        return

    try:
        model_data = base64.b64decode(MODEL_BASE64)
        with open(MODEL_PATH, "wb") as f:
            f.write(model_data)
        print("Model created successfully.")
    except Exception as e:
        print(f"An error occurred while decoding or writing the model: {e}")

if __name__ == "__main__":
    load_model()
