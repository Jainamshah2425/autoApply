/**
 * Test MongoDB Atlas connectivity.
 * Usage: node scripts/test-mongodb.js
 */
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('❌ MONGODB_URI is not set in backend/.env');
  process.exit(1);
}

// Mask password in logs
const safeUri = uri.replace(/:([^@/]+)@/, ':****@');
console.log('Testing connection to:', safeUri);

const hostMatch = uri.match(/@([^/?]+)/);
if (hostMatch) {
  console.log('Hostname:', hostMatch[1]);
}

mongoose
  .connect(uri, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    const dbName = mongoose.connection.db.databaseName;
    const ping = await mongoose.connection.db.admin().ping();
    console.log('✅ MongoDB connected successfully');
    console.log('   Database:', dbName);
    console.log('   Ping:', JSON.stringify(ping));
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed');
    console.error('   Error:', err.message);

    if (err.message.includes('ENOTFOUND') || err.message.includes('querySrv')) {
      console.error('\n→ The cluster hostname does not exist.');
      console.error('  Your Atlas cluster may have been deleted or the URI is outdated.');
      console.error('  Fix: MongoDB Atlas → your cluster → Connect → copy a new connection string.');
    } else if (err.message.includes('bad auth') || err.message.includes('Authentication failed')) {
      console.error('\n→ Wrong username or password in MONGODB_URI.');
      console.error('  Fix: Atlas → Database Access → edit user password, update backend/.env');
    } else if (err.message.includes('timed out')) {
      console.error('\n→ Could not reach Atlas (network or IP whitelist).');
      console.error('  Fix: Atlas → Network Access → Add IP → Allow Access from Anywhere (0.0.0.0/0)');
    }

    process.exit(1);
  });
