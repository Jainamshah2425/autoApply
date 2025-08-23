// routes/user.js
const Resume = require('../models/Resume');
const express = require('express');
const User = require('../models/User.js');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const { seedUserProfileData } = require('../utils/seedUserData');
const { syncUserStats } = require('../services/userStatsService');

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

// POST /api/user/create - Create a new user
router.post('/create', async (req, res) => {
  try {
    const { email, name, image } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json(existingUser);
    }
    
    // Create new user with default values
    const newUser = new User({
      email,
      name: name || email.split('@')[0],
      image: image || null,
      stats: {
        level: 1,
        xp: 0,
        interviewsCompleted: 0,
        averageScore: 0,
        totalPracticeTime: 0,
        improvementRate: 0,
        currentStreak: 0,
        longestStreak: 0
      },
      preferences: {
        notifications: {
          email: true,
          push: true,
          dailyReminders: false,
          weeklyReports: true
        },
        privacy: {
          showEmail: true,
          showLocation: true,
          showSocialLinks: true,
          showContributions: true,
          showStats: true,
          showAchievements: true
        }
      },
      contributions: [],
      achievements: []
    });
    
    const savedUser = await newUser.save();
    console.log('✅ New user created:', savedUser.email);
    
    res.status(201).json(savedUser);
  } catch (error) {
    console.error('❌ Failed to create user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

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

      // Track resume upload activity using HeatmapService
      try {
        const HeatmapService = require('../services/heatmapService');
        
        const activityDetails = {
          description: 'Uploaded resume document',
          metadata: {
            fileName: req.file?.originalname || 'resume.pdf',
            fileSize: req.file?.size || 0,
            uploadPath: filename
          }
        };

        await HeatmapService.addActivity(userId, 'resume_upload', activityDetails);
      } catch (trackingError) {
        console.warn('Resume upload tracking failed:', trackingError);
        // Don't fail the upload if tracking fails
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

// GET /api/user/contributions/:userId - Return user's activity data
router.get('/contributions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { start, end } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let contributions = user.contributions || [];

    // Filter by date range if provided
    if (start && end) {
      const startDate = new Date(start).toISOString().split('T')[0];
      const endDate = new Date(end).toISOString().split('T')[0];
      
      contributions = contributions.filter(contrib => 
        contrib.date >= startDate && contrib.date <= endDate
      );
    }

    res.json(contributions);
  } catch (error) {
    console.error('Error fetching contributions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/user/stats/:userId - Return user stats
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return stats with defaults if not set
    const stats = {
      totalInterviews: user.stats?.totalInterviews || 0,
      totalQuestions: user.stats?.totalQuestions || 0,
      averageScore: user.stats?.averageScore || 0,
      improvementRate: user.stats?.improvementRate || 0,
      totalVideoTime: user.stats?.totalVideoTime || 0,
      level: user.stats?.level || 1,
      experiencePoints: user.stats?.experiencePoints || 0,
      nextLevelPoints: user.stats?.nextLevelPoints || 1000,
      weeklyGoal: user.stats?.weeklyGoal || 5,
      weeklyProgress: user.stats?.weeklyProgress || 0,
      currentStreak: user.stats?.currentStreak || 0,
      longestStreak: user.stats?.longestStreak || 0,
      favoriteTopics: user.stats?.favoriteTopics || [],
      recentAchievements: user.stats?.recentAchievements || [],
      skillProgress: user.stats?.skillProgress || {}
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/user/profile/:userId - Update user profile fields
router.put('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updateFields = req.body;

    // Filter out fields that shouldn't be updated directly
    const allowedFields = [
      'fullName', 'username', 'bio', 'location', 'website', 
      'professionalBackground', 'profilePicture', 'phone', 
      'linkedIn', 'github', 'currentTitle', 'company'
    ];

    const filteredUpdates = {};
    Object.keys(updateFields).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updateFields[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      userId,
      filteredUpdates,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/user/privacy/:userId - Save privacy settings
router.put('/privacy/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const privacySettings = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { 'settings.privacy': privacySettings },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, privacy: user.settings.privacy });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper endpoint to add contribution data
router.post('/add-contribution/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, description } = req.body;

    const today = new Date().toISOString().split('T')[0];

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find or create today's contribution entry
    const existingContribution = user.contributions.find(c => c.date === today);
    
    if (existingContribution) {
      existingContribution.count += 1;
      existingContribution.activities.push({
        type,
        description,
        timestamp: new Date()
      });
    } else {
      user.contributions.push({
        date: today,
        count: 1,
        activities: [{
          type,
          description,
          timestamp: new Date()
        }]
      });
    }

    await user.save();
    res.json({ success: true, message: 'Contribution added' });
  } catch (error) {
    console.error('Error adding contribution:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper endpoint to update user stats
router.post('/update-stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const statsUpdate = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Initialize stats if not present
    if (!user.stats) {
      user.stats = {};
    }

    // Update stats
    Object.keys(statsUpdate).forEach(key => {
      if (user.stats[key] !== undefined || statsUpdate[key] !== undefined) {
        user.stats[key] = statsUpdate[key];
      }
    });

    await user.save();
    res.json({ success: true, stats: user.stats });
  } catch (error) {
    console.error('Error updating stats:', error);
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

// Development endpoint to seed sample data for testing
router.post('/seed-sample-data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await seedUserProfileData(userId);
    res.json(result);
  } catch (error) {
    console.error('Error seeding sample data:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Sync user stats from interview sessions and video analysis
router.post('/sync-stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = await syncUserStats(userId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error syncing user stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;