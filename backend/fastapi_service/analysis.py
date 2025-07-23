import os
import cv2
import numpy as np
import mediapipe as mp
from scipy.spatial.transform import Rotation as R

# Get the absolute path to the model file
model_path = os.path.join(os.path.dirname(__file__), 'models', 'emotion-ferplus-8.onnx')

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, min_detection_confidence=0.5)

# Emotion list
EMOTIONS = ["neutral", "happiness", "surprise", "sadness", "anger", "disgust", "fear", "contempt"]

def get_gaze_direction(landmarks, frame_shape):
    """
    Calculates the gaze direction from facial landmarks.
    Args:
        landmarks: Facial landmarks from MediaPipe.
        frame_shape: The shape of the video frame.
    Returns:
        A string indicating the gaze direction.
    """
    height, width, _ = frame_shape
    face_2d = []
    face_3d = []

    for idx, lm in enumerate(landmarks.landmark):
        if idx in [33, 263, 1, 61, 291, 199]:
            x, y = int(lm.x * width), int(lm.y * height)
            face_2d.append([x, y])
            face_3d.append([x, y, lm.z])

    face_2d = np.array(face_2d, dtype=np.float64)
    face_3d = np.array(face_3d, dtype=np.float64)

    focal_length = 1 * width
    cam_matrix = np.array([[focal_length, 0, width / 2],
                           [0, focal_length, height / 2],
                           [0, 0, 1]])
    dist_matrix = np.zeros((4, 1), dtype=np.float64)

    success, rot_vec, trans_vec = cv2.solvePnP(face_3d, face_2d, cam_matrix, dist_matrix)
    rmat, _ = cv2.Rodrigues(rot_vec)
    angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
    
    if angles[1] < -15:
        return "Looking Left"
    elif angles[1] > 15:
        return "Looking Right"
    elif angles[0] < -15:
        return "Looking Down"
    else:
        return "Forward"

def get_blink_rate(landmarks):
    """
    Calculates the blink rate from facial landmarks.
    Args:
        landmarks: Facial landmarks from MediaPipe.
    Returns:
        A boolean indicating if a blink is detected.
    """
    left_eye_pts = [362, 385, 387, 263, 373, 380]
    right_eye_pts = [33, 160, 158, 133, 153, 144]
    
    def eye_aspect_ratio(eye_pts):
        p1 = landmarks.landmark[eye_pts[0]]
        p2 = landmarks.landmark[eye_pts[1]]
        p3 = landmarks.landmark[eye_pts[2]]
        p4 = landmarks.landmark[eye_pts[3]]
        p5 = landmarks.landmark[eye_pts[4]]
        p6 = landmarks.landmark[eye_pts[5]]
        
        A = np.linalg.norm(np.array([p2.x, p2.y]) - np.array([p6.x, p6.y]))
        B = np.linalg.norm(np.array([p3.x, p3.y]) - np.array([p5.x, p5.y]))
        C = np.linalg.norm(np.array([p1.x, p1.y]) - np.array([p4.x, p4.y]))
        
        return (A + B) / (2.0 * C)

    left_ear = eye_aspect_ratio(left_eye_pts)
    right_ear = eye_aspect_ratio(right_eye_pts)
    
    ear = (left_ear + right_ear) / 2.0
    return ear < 0.2

def is_speaking(landmarks):
    """
    Detects if the person is speaking based on mouth movement.
    Args:
        landmarks: Facial landmarks from MediaPipe.
    Returns:
        A boolean indicating if speaking is detected.
    """
    upper_lip_pts = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
    lower_lip_pts = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]
    
    upper_lip_mean = np.mean([(landmarks.landmark[p].x, landmarks.landmark[p].y) for p in upper_lip_pts], axis=0)
    lower_lip_mean = np.mean([(landmarks.landmark[p].x, landmarks.landmark[p].y) for p in lower_lip_pts], axis=0)
    
    distance = np.linalg.norm(upper_lip_mean - lower_lip_mean)
    return distance > 0.04

def analyze_video(video_path):
    """
    Analyzes a video file to extract head pose, gaze, blink rate, speaking, and emotion.
    Args:
        video_path: The path to the video file.
    Returns:
        A dictionary containing the analysis results.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": "Could not open video file."}

    results = {
        "head_pose": [], "gaze": [], "blinks": 0, "speaking_frames": 0, "emotions": []
    }
    
    emotion_model = cv2.dnn.readNetFromONNX(model_path)
    
    blink_counter = 0
    speaking_counter = 0
    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_results = face_mesh.process(rgb_frame)

        if face_results.multi_face_landmarks:
            for face_landmarks in face_results.multi_face_landmarks:
                # Head Pose
                h, w, _ = frame.shape
                face_3d = np.array([(lm.x, lm.y, lm.z) for lm in face_landmarks.landmark])
                rot = R.from_euler('xyz', face_3d.mean(axis=0), degrees=True)
                pitch, yaw, roll = rot.as_euler('xyz', degrees=True)
                results["head_pose"].append({"pitch": pitch, "yaw": yaw, "roll": roll})

                # Gaze
                gaze = get_gaze_direction(face_landmarks, frame.shape)
                results["gaze"].append(gaze)

                # Blinks
                if get_blink_rate(face_landmarks):
                    blink_counter += 1

                # Speaking
                if is_speaking(face_landmarks):
                    speaking_counter += 1

                # Emotion
                x_min = int(min([lm.x for lm in face_landmarks.landmark]) * w)
                y_min = int(min([lm.y for lm in face_landmarks.landmark]) * h)
                x_max = int(max([lm.x for lm in face_landmarks.landmark]) * w)
                y_max = int(max([lm.y for lm in face_landmarks.landmark]) * h)
                
                face_roi = frame[y_min:y_max, x_min:x_max]
                if face_roi.size == 0:
                    continue
                
                gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
                resized_face = cv2.resize(gray_face, (64, 64))
                processed_face = resized_face.astype(np.float32) / 255.0
                processed_face = np.expand_dims(np.expand_dims(processed_face, -1), 0)
                
                emotion_model.setInput(processed_face)
                emotion_preds = emotion_model.forward()
                emotion_idx = np.argmax(emotion_preds)
                results["emotions"].append(EMOTIONS[emotion_idx])

    cap.release()
    cv2.destroyAllWindows()
    del cap
    
    results["blinks"] = blink_counter
    results["speaking_frames"] = speaking_counter
    results["total_frames"] = frame_count
    
    return results
