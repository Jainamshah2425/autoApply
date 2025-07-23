// // services/jobService.js
// const axios = require('axios');
// const cheerio = require('cheerio');
// const Job = require('../models/Job.js');

// async function scrapeInternshalaJobs() {
//   const res = await axios.get('https://internshala.com/internships/webinternship');
//   const $ = cheerio.load(res.data);
//   const jobs = [];

//   $('.individual_internship').each((i, el) => {
//     const title = $(el).find('.profile').text().trim();
//     const company = $(el).find('.company_name').text().trim();
//     const url = 'https://internshala.com' + $(el).find('a').attr('href');
//     const location = $(el).find('.location_link').first().text().trim();
//     jobs.push({ title, company, location, url });
//   });

//   await Job.insertMany(jobs);
//   return jobs;
// }

// async function autoApplyToJobs(userId) {
//   const jobs = await Job.find({ applied: false });
//   const applied = [];

//   for (const job of jobs.slice(0, 5)) { // limit to avoid abuse
//     // Simulate apply logic
//     job.applied = true;
//     await job.save();
//     applied.push(job);
//   }

//   return { appliedCount: applied.length };
// }

// module.exports = { scrapeInternshalaJobs, autoApplyToJobs };
// services/jobService.js
const axios = require('axios');
const cheerio = require('cheerio');
const Job = require('../models/Job.js');

async function scrapeInternshalaJobs(url) {
  try {
    console.log(`Scraping URL: ${url}`);
    
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(res.data);
    const jobs = [];

    // Log the page title to verify we got the right page
    const pageTitle = $('title').text();
    console.log(`Page title: ${pageTitle}`);

    // Multiple selector strategies for different Internshala layouts
    const selectors = [
      {
        container: '.individual_internship',
        title: '.heading_4_5, .profile h3, .profile, .job-title',
        company: '.heading_6.company_name, .company_name, .company h4, .company-name',
        url: 'a.view_detail_button, a[href*="/internship/detail/"], .view_detail_button, a.btn-primary',
        location: '.location_link, .internship_location, .location, .internship-location'
      },
      {
        container: '.internship_meta',
        title: '.profile, .internship-title, h3',
        company: '.company_name, .company-name, .company h4',
        url: 'a[href*="/internship/detail/"], a.view_detail_button, a.btn-primary',
        location: '.location_link, .location, .internship-location'
      },
      {
        container: '.internship-tile, .job-tile',
        title: '.internship-title, .job-title, h3',
        company: '.company-name, .company h4',
        url: 'a[href*="/internship/detail/"], a.view_detail_button',
        location: '.location, .internship-location'
      }
    ];

    // Try each selector strategy
    for (const selectorSet of selectors) {
      const containers = $(selectorSet.container);
      console.log(`Found ${containers.length} containers with selector: ${selectorSet.container}`);
      
      if (containers.length > 0) {
        containers.each((i, el) => {
          const title = $(el).find(selectorSet.title).first().text().trim();
          const company = $(el).find(selectorSet.company).first().text().trim();
          const relativeUrl = $(el).find(selectorSet.url).first().attr('href');
          const location = $(el).find(selectorSet.location).first().text().trim();
          
          let fullUrl = '';
          if (relativeUrl) {
            fullUrl = relativeUrl.startsWith('http') 
              ? relativeUrl 
              : `https://internshala.com${relativeUrl.startsWith('/') ? '' : '/'}${relativeUrl}`;
          }

          // Debug logging
          console.log(`Job ${i + 1}:`);
          console.log(`  Title: "${title}"`);
          console.log(`  Company: "${company}"`);
          console.log(`  Location: "${location}"`);
          console.log(`  URL: "${fullUrl}"`);

          if (title && company && fullUrl) {
            jobs.push({ 
              title, 
              company, 
              location: location || 'Not specified', 
              url: fullUrl 
            });
          }
        });
        
        // If we found jobs with this selector, break
        if (jobs.length > 0) {
          console.log(`Successfully scraped ${jobs.length} jobs using selector: ${selectorSet.container}`);
          break;
        }
      }
    }

    // If no jobs found, log the page structure for debugging
    if (jobs.length === 0) {
      console.log('No jobs found. Debugging page structure...');
      
      // Log common class names to help identify the correct selectors
      const commonClasses = [];
      $('[class*="internship"], [class*="job"], [class*="individual"]').each((i, el) => {
        const className = $(el).attr('class');
        if (className && !commonClasses.includes(className)) {
          commonClasses.push(className);
        }
      });
      
      console.log('Found classes containing "internship", "job", or "individual":');
      commonClasses.slice(0, 10).forEach(cls => console.log(`  - ${cls}`));
      
      // Log first few divs with meaningful content
      console.log('\nFirst few divs with text content:');
      $('div').slice(0, 20).each((i, el) => {
        const text = $(el).text().trim();
        const className = $(el).attr('class');
        if (text.length > 20 && text.length < 200 && className) {
          console.log(`  - ${className}: "${text.substring(0, 100)}..."`);
        }
      });
      
      throw new Error('No jobs scraped — Internshala structure might have changed or the page might be using JavaScript rendering');
    }

    // Remove duplicates based on URL
    const uniqueJobs = jobs.filter((job, index, self) =>
      index === self.findIndex(j => j.url === job.url)
    );

    console.log(`Found ${uniqueJobs.length} unique jobs`);

    // Clear existing jobs and insert new ones
    await Job.deleteMany({});
    await Job.insertMany(uniqueJobs);
    
    return uniqueJobs;
  } catch (err) {
    console.error('Internshala scrape error:', err.message);
    
    // If it's a network error, provide more specific feedback
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw new Error('Network error: Unable to connect to Internshala');
    } else if (err.response && err.response.status === 403) {
      throw new Error('Access denied: Internshala blocked the request');
    } else if (err.response && err.response.status === 404) {
      throw new Error('Page not found: The internship category might not exist');
    }
    
    throw err;
  }
}

async function autoApplyToJobs(userId) {
  try {
    const jobs = await Job.find({ applied: false });
    const applied = [];

    for (const job of jobs.slice(0, 5)) {
      // Simulate apply logic - in real implementation, this would involve:
      // 1. Login to Internshala
      // 2. Navigate to job page
      // 3. Fill application form
      // 4. Submit application
      
      job.applied = true;
      await job.save();
      applied.push(job);
    }

    return { appliedCount: applied.length, jobs: applied };
  } catch (err) {
    console.error('Auto-apply error:', err.message);
    throw err;
  }
}

module.exports = { scrapeInternshalaJobs, autoApplyToJobs };