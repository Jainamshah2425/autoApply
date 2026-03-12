// cron/keepAlive.js
// Pings the backend every 14 minutes to prevent Render free-tier spin-down.
// Only active between 07:00–23:00 UTC to stay within the 750-hour free limit.

const cron = require('node-cron');

/**
 * Schedules a keep-alive ping to the backend's public URL.
 * Uses RENDER_EXTERNAL_URL (auto-provided by Render) or falls back to localhost.
 */
function scheduleKeepAlive() {
  const PORT = process.env.PORT || 5000;
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

  if (!process.env.RENDER_EXTERNAL_URL) {
    console.log('⚠️  RENDER_EXTERNAL_URL not set — keep-alive will ping localhost (local dev mode).');
  }

  // Every 14 minutes, between 07:00 and 22:59 UTC
  cron.schedule('*/14 7-22 * * *', async () => {
    try {
      const response = await fetch(`${url}/`);
      console.log(`🏓 Keep-alive ping → ${url} | Status: ${response.status} | ${new Date().toISOString()}`);
    } catch (err) {
      console.error(`❌ Keep-alive ping failed: ${err.message}`);
    }
  });

  console.log(`⏰ Keep-alive cron scheduled — pinging ${url} every 14 min (07:00–23:00 UTC)`);
}

module.exports = { scheduleKeepAlive };
