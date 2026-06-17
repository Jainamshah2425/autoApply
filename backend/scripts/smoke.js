/**
 * Load route modules without starting the HTTP server (CI smoke test).
 */
const routes = [
  '../routes/llm.js',
  '../routes/user.js',
  '../routes/jobs.js',
  '../routes/auth.js',
  '../routes/email.js',
  '../routes/interview.js',
  '../routes/profile.js',
  '../routes/liveInterview.js',
  '../routes/aptitude.js',
];

for (const route of routes) {
  require(route);
}

console.log('Backend route modules loaded successfully.');
