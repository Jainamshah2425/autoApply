// routes/user.js
const Resume = require('../models/Resume');
const express = require('express');
const User = require('../models/User.js');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

// Configure multer with file validation
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

const router = express.Router();

router.post('/upload-resume', (req, res) => {
  upload.single('resume')(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size too large. Maximum 5MB allowed.' });
        }
      }
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    try {
      const userId = req.body.userId;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Resume file is missing' });
      }

      // 1. Read the uploaded PDF file into a buffer
      const dataBuffer = fs.readFileSync(req.file.path);

      // 2. Parse the PDF to extract text
      const data = await pdfParse(dataBuffer);
      const resumeText = data.text;

      // 3. Create a new Resume document, now including the PDF data
      const newResume = new Resume({
        user: userId,
        text: resumeText,
        pdf: dataBuffer, // <-- This is the critical fix
        filePath: req.file.path,
      });

      // 4. Save the new resume to the database
      await newResume.save();

      // 5. Clean up the uploaded file from the server's disk
      fs.unlinkSync(req.file.path);

      // Update user with resume file path
      const updatedUser = await User.findByIdAndUpdate(
        userId, 
        { resume: newResume._id }, // Save the new resume's ID
        { new: true }
      );

      if (!updatedUser) {
        // This case is unlikely if the user was found before, but good practice
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('Resume uploaded successfully for user:', userId);
      res.json({ 
        success: true, 
        message: 'Resume uploaded successfully',
        filePath: req.file.path
      });

    } catch (error) {
      console.error('Error processing resume:', error);
      
      // Clean up uploaded file if it exists on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({ error: 'Internal server error while processing resume' });
    }
  });
});

router.get('/by-email/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('Found user:', user); // Log the user object
    res.json(user);
  } catch (error) {
    console.error('Error finding user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/set-preferences', async (req, res) => {
  try {
    const { userId, preferences } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = await User.findByIdAndUpdate(
      userId, 
      { preferences }, 
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error setting preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;