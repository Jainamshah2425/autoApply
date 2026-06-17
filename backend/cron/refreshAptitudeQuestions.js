/**
 * Scheduled refresh of the aptitude question bank (LLM-generated batches).
 *
 * Env:
 *   APTITUDE_REFRESH_CRON — cron expression (default: weekly Sunday 03:00 UTC)
 *   APTITUDE_REFRESH_ENABLED — set to "false" to disable (default: true)
 */
const cron = require('node-cron');
const { refreshQuestionBank } = require('../services/aptitudeService.js');

function scheduleAptitudeRefresh() {
  if (process.env.APTITUDE_REFRESH_ENABLED === 'false') {
    console.log('⏭️  Aptitude question refresh cron disabled');
    return;
  }

  const expression = process.env.APTITUDE_REFRESH_CRON || '0 3 * * 0';
  if (!cron.validate(expression)) {
    console.warn(`⚠️  Invalid APTITUDE_REFRESH_CRON "${expression}" — refresh not scheduled`);
    return;
  }

  cron.schedule(expression, async () => {
    console.log('📚 Running scheduled aptitude question refresh...');
    try {
      const result = await refreshQuestionBank();
      console.log(
        `📚 Aptitude refresh done: +${result.totalAdded} questions, ` +
        `${result.pruned} pruned, bank size ${result.finalCount}`
      );
      if (result.errors.length) console.warn('Refresh warnings:', result.errors);
    } catch (err) {
      console.error('❌ Aptitude refresh cron failed:', err.message);
    }
  });

  console.log(`⏰ Aptitude refresh scheduled — cron "${expression}"`);
}

module.exports = { scheduleAptitudeRefresh };
