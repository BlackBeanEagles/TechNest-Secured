const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    skip: (req) => req.method === 'GET' && req.path.startsWith('/api/products')
});

// Strict limiter for auth endpoints (prevents brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again in 15 minutes' },
    skipSuccessfulRequests: true  // Only count failed attempts
});

// Very strict limiter for registration (prevents account spam)
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many registration attempts, please try again in 1 hour' }
});

module.exports = { apiLimiter, authLimiter, registerLimiter };
