// // routes/jobs.js
// const express = require('express');
// const { scrapeInternshalaJobs, autoApplyToJobs } = require('../services/jobService');


// const router = express.Router();

// router.get('/scrape', async (req, res) => {
//   const domain = req.query.domain || 'web-development';
//   const url = `https://internshala.com/internships/${domain}`;

//   try {
//     const jobs = await scrapeInternshalaJobs(url);
//     res.json(jobs);
//   } catch (err) {
//     console.error('Scrape failed:', err);
//     res.status(500).json({ error: 'Scraping failed' });
//   }
// });


// router.post('/auto-apply', async (req, res) => {
//   const { userId } = req.body;
//   try {
//     const result = await autoApplyToJobs(userId);
//     res.json(result);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).json({ error: 'Auto-apply failed' });
//   }
// });

// module.exports = router;


// routes/jobs.js
const express = require('express');
const { scrapeInternshalaJobs, autoApplyToJobs } = require('../services/jobService');

const router = express.Router();

// Domain mapping for Internshala URLs
const domainMapping = {
  'web-development': 'web-development-internship',
  'data-science': 'data-science-internship',
  'machine-learning': 'machine-learning-internship',
  'marketing': 'marketing-internship',
  'ui-ux': 'ui-ux-design-internship',
  'graphic-design': 'graphic-design-internship',
  'finance': 'finance-internship',
  'full-stack': 'full-stack-development-internship',
  'frontend': 'front-end-development-internship',
  'backend': 'backend-development-internship',
  'mobile-development': 'mobile-app-development-internship',
  'content-writing': 'content-writing-internship',
  'digital-marketing': 'digital-marketing-internship',
  'social-media': 'social-media-marketing-internship',
  'human-resources': 'human-resources-internship',
  'business-development': 'business-development-internship'
};

router.get('/scrape', async (req, res) => {
  try {
    const domain = req.query.domain || 'web-development';
    console.log(`Received scrape request for domain: ${domain}`);
    
    // Map the domain to the correct Internshala URL format
    const internshalaPath = domainMapping[domain] || `${domain}-internship`;
    const url = `https://internshala.com/internships/${internshalaPath}/`;
    
    console.log(`Mapped to URL: ${url}`);
    
    const jobs = await scrapeInternshalaJobs(url);
    
    res.json({
      success: true,
      count: jobs.length,
      domain: domain,
      url: url,
      jobs: jobs
    });
  } catch (err) {
    console.error('Scrape failed:', err.message);
    
    // Return more detailed error information
    res.status(500).json({ 
      success: false,
      error: 'Scraping failed',
      message: err.message,
      domain: req.query.domain || 'web-development'
    });
  }
});

router.post('/auto-apply', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'User ID is required' 
      });
    }
    
    console.log(`Auto-applying for user: ${userId}`);
    const result = await autoApplyToJobs(userId);
    
    res.json({
      success: true,
      appliedCount: result.appliedCount,
      jobs: result.jobs
    });
  } catch (err) {
    console.error('Auto-apply failed:', err.message);
    res.status(500).json({ 
      success: false,
      error: 'Auto-apply failed',
      message: err.message
    });
  }
});

// New endpoint to test connectivity
router.get('/test', async (req, res) => {
  res.json({
    success: true,
    message: 'Jobs API is working',
    availableDomains: Object.keys(domainMapping)
  });
});

module.exports = router;