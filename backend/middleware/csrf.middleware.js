const { randomBytes } = require('crypto');

// Double-Submit Cookie CSRF Protection
// 1. On login, server sets csrf_token in a readable cookie
// 2. Frontend reads cookie and sends it back as X-CSRF-Token header
// 3. Server verifies header === cookie value

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function generateCsrfToken() {
    return randomBytes(32).toString('hex');
}

function setCsrfCookie(res, token) {
    res.cookie('csrf_token', token, {
        httpOnly: false,        // Must be readable by JS
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
}

function verifyCsrf(req, res, next) {
    if (SAFE_METHODS.has(req.method)) return next();

    const cookieToken  = req.cookies?.csrf_token;
    const headerToken  = req.headers['x-csrf-token'];

    if (!cookieToken || !headerToken) {
        return res.status(403).json({ error: 'CSRF token missing' });
    }

    // Constant-time comparison to prevent timing attacks
    const crypto = require('crypto');
    const a = Buffer.from(cookieToken, 'hex');
    const b = Buffer.from(headerToken, 'hex');

    if (a.length !== b.length) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    try {
        if (!crypto.timingSafeEqual(a, b)) {
            return res.status(403).json({ error: 'Invalid CSRF token' });
        }
    } catch {
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    next();
}

module.exports = { generateCsrfToken, setCsrfCookie, verifyCsrf };
