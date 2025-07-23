const Bull = require('bull');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const videoQueue = new Bull('video-processing', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  },
});

const Video = require('../models/Video');

videoQueue.process(async (job) => {
  const { videoId } = job.data;

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    // Example processing: generate a thumbnail
    const thumbnailPath = path.join(
      path.dirname(video.filePath),
      `thumbnail-${path.basename(video.filePath, path.extname(video.filePath))}.jpg`
    );

    const command = `ffmpeg -i "${video.filePath}" -ss 00:00:01.000 -vframes 1 "${thumbnailPath}"`;

    exec(command, (error) => {
      if (error) {
        console.error(`Error generating thumbnail for ${video.filePath}:`, error);
        return;
      }
      console.log(`Thumbnail generated for ${video.filePath}`);
    });

    // You can add more video processing tasks here, such as:
    // - Transcoding to different formats
    // - Watermarking
    // - Video analysis (e.g., using a cloud service)

  } catch (error) {
    console.error(`Failed to process video ${videoId}:`, error);
    // Optionally, you can retry the job or move it to a failed queue
    throw error;
  }
});

console.log('Video processing worker started');
