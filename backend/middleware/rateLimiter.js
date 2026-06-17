const rateLimit = require('express-rate-limit');

const groqRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many AI requests. Please wait a minute and try again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.body?.userId || 'anonymous',
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

const liveInterviewRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many interview requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.userId || req.user?.id || 'anonymous'
});

class MemoryRateLimiter {
  constructor(windowMs = 60000, maxRequests = 20) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map();
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.requests) {
      if (now - data.resetTime > this.windowMs) {
        this.requests.delete(key);
      }
    }
  }

  check(key) {
    const now = Date.now();
    const data = this.requests.get(key);

    if (!data || now > data.resetTime) {
      this.requests.set(key, { count: 1, resetTime: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    if (data.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((data.resetTime - now) / 1000)
      };
    }

    data.count++;
    return { allowed: true, remaining: this.maxRequests - data.count };
  }
}

const serviceRateLimiter = new MemoryRateLimiter(60000, 20);

module.exports = {
  groqRateLimiter,
  liveInterviewRateLimiter,
  serviceRateLimiter,
  MemoryRateLimiter
};
