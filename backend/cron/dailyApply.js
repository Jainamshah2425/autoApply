// // cron/dailyApply.js
// const cron = require('node-cron');
// const { autoApplyToJobs } = require('../services/jobService.js');

// module.exports = { scheduleAutoApply };
//   cron.schedule('0 10 * * *', async () => {
//     console.log('Running daily auto-apply...');
//     await autoApplyToJobs(); // You can loop through all users if needed
//   });


// cron/dailyApply.js
const cron = require('node-cron');
const { autoApplyToJobs } = require('../services/jobService.js');

function scheduleAutoApply() {
  cron.schedule('0 10 * * *', async () => {
    console.log('Running daily auto-apply...');
    await autoApplyToJobs(); // You can loop through all users if needed
  });
}

module.exports = { scheduleAutoApply };

