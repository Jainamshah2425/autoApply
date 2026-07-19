// In-memory cache for the current session's backend access token, kept in
// sync by <SessionTokenSync> so the axios interceptor in lib/api.js can read
// it synchronously without an extra network round-trip per request.
let currentAccessToken = null;

export function setAccessToken(token) {
  currentAccessToken = token || null;
}

export function getAccessToken() {
  return currentAccessToken;
}
