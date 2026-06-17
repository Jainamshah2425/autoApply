/**
 * Seed aptitude questions when the bank is empty (uses backend/.env MONGODB_URI).
 * Usage: node scripts/seedAptitudeIfEmpty.js
 */
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const { execSync } = require('child_process');

const mongoose = require('mongoose');
const AptitudeQuestion = require('../models/AptitudeQuestion');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const count = await AptitudeQuestion.countDocuments();
  console.log(`Current question count: ${count}`);

  if (count > 0) {
    console.log('Question bank already populated — skipping seed.');
    await mongoose.disconnect();
    return;
  }

  await mongoose.disconnect();

  const seedScript = path.join(__dirname, '..', '..', 'execution', 'seed_aptitude_questions.js');
  execSync(`node "${seedScript}"`, { stdio: 'inherit', env: process.env });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
