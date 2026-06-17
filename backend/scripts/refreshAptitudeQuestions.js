/**
 * Manually refresh aptitude questions via LLM (same logic as the cron job).
 * Usage: npm run refresh:aptitude
 */
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();

const mongoose = require('mongoose');
const { refreshQuestionBank } = require('../services/aptitudeService');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY not set — cannot generate new questions');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to', mongoose.connection.db.databaseName);

  const result = await refreshQuestionBank();
  console.log(JSON.stringify(result, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
