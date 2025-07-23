// services/matcher.js
function isJobMatch(job, preferences) {
  const titleMatch = preferences.jobTitles.some((t) =>
    job.title.toLowerCase().includes(t.toLowerCase())
  );
  const skillMatch = preferences.skills.some((s) =>
    job.title.toLowerCase().includes(s.toLowerCase())
  );
  const locationMatch = preferences.remoteOnly
    ? job.location.toLowerCase().includes('remote')
    : true;

  return titleMatch && skillMatch && locationMatch;
}

module.exports = { isJobMatch };
