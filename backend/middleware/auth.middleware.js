const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    // Token from httpOnly cookie (XSS-safe) or Authorization header (API clients)
    const token = req.cookies?.access_token ||
        (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : null);

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        req.user = {
            id: decoded.id,
            username: decoded.username,
            role: decoded.role
        };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

module.exports = { verifyToken };
