"use client";
import { useState } from 'react';

export default function VideoRecordingTest() {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);

  const startRecording = async () => {
    try {
      console.log('Requesting camera permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      console.log('Camera permission granted');
      
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });
      
      const chunks = [];
      
      recorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size);
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        console.log('Recording stopped, creating blob...');
        const blob = new Blob(chunks, { type: 'video/webm' });
        console.log('Blob created:', blob.size, 'bytes');
        setVideoBlob(blob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      console.log('Recording started');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording: ' + error.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.log('Stopping recording...');
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const uploadVideo = async () => {
    if (!videoBlob) {
      alert('No video to upload');
      return;
    }

    console.log('Uploading video...');
    const formData = new FormData();
    formData.append('video', videoBlob, 'test-recording.webm');
    
    try {
      const response = await fetch('https://autoapply-xsj0.onrender.com/api/interview/analyze-video', {
        method: 'POST',
        body: formData,
      });
      
      console.log('Upload response status:', response.status);
      const result = await response.json();
      console.log('Upload result:', result);
      
      if (response.ok) {
        alert('Video uploaded successfully! Check console for details.');
      } else {
        alert('Upload failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Video Recording Test</h1>
      
      <div className="space-y-4">
        <div className="flex gap-4">
          <button
            onClick={startRecording}
            disabled={isRecording}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {isRecording ? 'Recording...' : 'Start Recording'}
          </button>
          
          <button
            onClick={stopRecording}
            disabled={!isRecording}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            Stop Recording
          </button>
          
          <button
            onClick={uploadVideo}
            disabled={!videoBlob}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Upload Video
          </button>
        </div>
        
        {videoBlob && (
          <div className="mt-4">
            <p className="text-green-600">✅ Video recorded ({Math.round(videoBlob.size / 1024)}KB)</p>
            <video
              src={URL.createObjectURL(videoBlob)}
              controls
              className="mt-2 w-full max-w-md border rounded"
            />
          </div>
        )}
      </div>
      
      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-bold">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Click &quot;Start Recording&quot; and allow camera permission</li>
          <li>Record a short video (3-5 seconds)</li>
          <li>Click &quot;Stop Recording&quot;</li>
          <li>Click &quot;Upload Video&quot; to test the backend</li>
          <li>Check browser console (F12) for detailed logs</li>
        </ol>
      </div>
    </div>
  );
}
