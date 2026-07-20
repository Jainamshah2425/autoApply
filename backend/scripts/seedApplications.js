/**
 * Backfill real Application records for one user by scraping several real
 * Internshala domains and recording each returned listing as an application,
 * the same way `POST /api/jobs/apply` does when a user clicks "Apply" for real.
 *
 * Usage: node scripts/seedApplications.js you@example.com [targetCount]
 */
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Application = require('../models/Application');
const { scrapeInternshalaJobs, recordApplication } = require('../services/jobService');

const DOMAINS = [
  'web-development-internship',
  'data-science-internship',
  'machine-learning-internship',
  'full-stack-development-internship',
  'front-end-development-internship',
  'backend-development-internship',
  'ui-ux-design-internship',
  'digital-marketing-internship',
  'content-writing-internship',
  'marketing-internship',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const email = process.argv[2];
  const targetCount = parseInt(process.argv[3], 10) || 55;

  if (!email) {
    console.error('Usage: node scripts/seedApplications.js you@example.com [targetCount]');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to', mongoose.connection.db?.databaseName || '(default)');

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`No user found with email ${email} — sign in via Google OAuth at least once first.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Seeding applications for user ${user._id} (${email})`);

  const existing = await Application.countDocuments({ user: user._id });
  console.log(`Existing application records: ${existing}`);

  const allJobs = [];
  for (const domainPath of DOMAINS) {
    if (allJobs.length >= targetCount) break;
    const url = `https://internshala.com/internships/${domainPath}/`;
    try {
      const jobs = await scrapeInternshalaJobs(url);
      console.log(`  ${domainPath}: ${jobs.length} jobs scraped`);
      allJobs.push(...jobs);
    } catch (err) {
      console.warn(`  ${domainPath}: skipped (${err.message})`);
    }
    await sleep(1500); // be polite to Internshala between requests
  }

  const uniqueJobs = Array.from(new Map(allJobs.map((j) => [String(j._id), j])).values());
  console.log(`Total unique scraped jobs available: ${uniqueJobs.length}`);

  let created = 0;
  for (const job of uniqueJobs) {
    if (existing + created >= targetCount) break;
    const before = await Application.exists({ user: user._id, job: job._id });
    await recordApplication(user._id, { jobId: job._id });
    if (!before) created++;
  }

  const total = await Application.countDocuments({ user: user._id });
  console.log(`\nCreated ${created} new application records.`);
  console.log(`Total application records for ${email}: ${total}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
