const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const { validateRegistration, validateLogin, sanitizeString } = require('../utils/validation');
const { generateCsrfToken, setCsrfCookie } = require('../middleware/csrf.middleware');

const BCRYPT_ROUNDS  = parseInt(process.env.BCRYPT_ROUNDS) || 12;
const MAX_FAIL_ATTEMPTS = 5;
const LOCKOUT_MINUTES   = 15;

function generateAccessToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m', issuer: 'technest' }
    );
}

function generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
}

function setTokenCookies(res, accessToken) {
    res.cookie('access_token', accessToken, {
        httpOnly: true,              // Not accessible via JS — prevents XSS token theft
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000      // 15 minutes
    });
}

async function register(req, res) {
    const errors = validateRegistration(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const username   = sanitizeString(req.body.username);
    const email      = sanitizeString(req.body.email).toLowerCase();
    const password   = req.body.password; // Raw for hashing — not sanitized
    const first_name = req.body.first_name ? sanitizeString(req.body.first_name) : null;
    const last_name  = req.body.last_name  ? sanitizeString(req.body.last_name)  : null;
    const phone      = req.body.phone      ? sanitizeString(req.body.phone)      : null;

    try {
        // Prepared statement — SQL injection safe
        const [existing] = await db.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Username or email already exists' });
        }

        const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const [result] = await db.execute(
            `INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone)
             VALUES (?, ?, ?, 'user', ?, ?, ?)`,
            [username, email, password_hash, first_name, last_name, phone]
        );

        // Audit log
        await db.execute(
            'INSERT INTO audit_logs (user_id, action, ip_address, user_agent) VALUES (?, ?, ?, ?)',
            [result.insertId, 'USER_REGISTERED', req.ip, req.headers['user-agent']?.substring(0, 255)]
        );

        res.status(201).json({ message: 'Registration successful. Please log in.' });
    } catch (err) {
        console.error('[Auth] Registration error:', err.message);
        res.status(500).json({ error: 'Registration failed' });
    }
}

async function login(req, res) {
    const errors = validateLogin(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const identifier = sanitizeString(req.body.identifier).toLowerCase();
    const password   = req.body.password;

    try {
        // Check by email or username — prepared statement
        const [rows] = await db.execute(
            `SELECT id, username, email, password_hash, role, is_active,
                    failed_login_attempts, locked_until
             FROM users
             WHERE email = ? OR username = ?
             LIMIT 1`,
            [identifier, identifier]
        );

        const user = rows[0];

        // Timing-safe: always hash even if user not found to prevent user enumeration
        if (!user) {
            await bcrypt.hash('dummy_prevent_timing_attack', BCRYPT_ROUNDS);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check account lockout
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
            return res.status(423).json({
                error: `Account locked. Try again in ${remaining} minute(s).`
            });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account disabled. Contact support.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            const newFailCount = (user.failed_login_attempts || 0) + 1;
            let lockedUntil = null;

            if (newFailCount >= MAX_FAIL_ATTEMPTS) {
                lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
            }

            await db.execute(
                'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
                [newFailCount, lockedUntil, user.id]
            );

            if (lockedUntil) {
                return res.status(423).json({
                    error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`
                });
            }
            return res.status(401).json({
                error: `Invalid credentials. ${MAX_FAIL_ATTEMPTS - newFailCount} attempts remaining.`
            });
        }

        // Reset failed attempts on successful login
        await db.execute(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
            [user.id]
        );

        const accessToken  = generateAccessToken(user);
        const refreshToken = generateRefreshToken();
        const refreshHash  = crypto.createHash('sha256').update(refreshToken).digest('hex');

        // Store refresh token hash (never the raw token)
        await db.execute(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
            [user.id, refreshHash]
        );

        // Generate CSRF token
        const csrfToken = generateCsrfToken();

        setTokenCookies(res, accessToken);
        setCsrfCookie(res, csrfToken);

        // Refresh token in httpOnly cookie
        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/api/auth/refresh'
        });

        // Audit log
        await db.execute(
            'INSERT INTO audit_logs (user_id, action, ip_address, user_agent) VALUES (?, ?, ?, ?)',
            [user.id, 'USER_LOGIN', req.ip, req.headers['user-agent']?.substring(0, 255)]
        );

        res.json({
            message: 'Login successful',
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (err) {
        console.error('[Auth] Login error:', err.message);
        res.status(500).json({ error: 'Login failed' });
    }
}

async function refreshToken(req, res) {
    const rawRefresh = req.cookies?.refresh_token;
    if (!rawRefresh) return res.status(401).json({ error: 'No refresh token' });

    const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');

    try {
        const [rows] = await db.execute(
            `SELECT rt.user_id, u.username, u.role, u.is_active
             FROM refresh_tokens rt
             JOIN users u ON u.id = rt.user_id
             WHERE rt.token_hash = ? AND rt.expires_at > NOW()
             LIMIT 1`,
            [tokenHash]
        );

        if (!rows.length || !rows[0].is_active) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        const user = rows[0];
        const newAccessToken = generateAccessToken(user);
        setTokenCookies(res, newAccessToken);

        res.json({ message: 'Token refreshed' });
    } catch (err) {
        console.error('[Auth] Refresh error:', err.message);
        res.status(500).json({ error: 'Token refresh failed' });
    }
}

async function logout(req, res) {
    const rawRefresh = req.cookies?.refresh_token;

    if (rawRefresh) {
        const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
        await db.execute('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]).catch(() => {});
    }

    if (req.user) {
        await db.execute(
            'INSERT INTO audit_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
            [req.user.id, 'USER_LOGOUT', req.ip]
        ).catch(() => {});
    }

    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    res.clearCookie('csrf_token');

    res.json({ message: 'Logged out successfully' });
}

async function me(req, res) {
    try {
        const [rows] = await db.execute(
            'SELECT id, username, email, role, first_name, last_name, phone, address, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'User not found' });
        res.json({ user: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
}

async function updateProfile(req, res) {
    const { first_name, last_name, phone, address } = req.body;
    const { PATTERNS } = require('../utils/validation');

    const errors = [];
    if (first_name && !PATTERNS.name.test(first_name.trim())) errors.push('Invalid first name');
    if (last_name  && !PATTERNS.name.test(last_name.trim()))  errors.push('Invalid last name');
    if (phone      && !PATTERNS.phone.test(phone.trim()))     errors.push('Invalid phone');
    if (address    && String(address).length > 500)           errors.push('Address too long');

    if (errors.length) return res.status(400).json({ errors });

    try {
        await db.execute(
            `UPDATE users SET first_name = ?, last_name = ?, phone = ?, address = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                first_name ? sanitizeString(first_name) : null,
                last_name  ? sanitizeString(last_name)  : null,
                phone      ? sanitizeString(phone)      : null,
                address    ? sanitizeString(address)    : null,
                req.user.id
            ]
        );
        res.json({ message: 'Profile updated' });
    } catch (err) {
        res.status(500).json({ error: 'Profile update failed' });
    }
}

module.exports = { register, login, logout, me, refreshToken, updateProfile };
