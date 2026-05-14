require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const cookieParser = require('cookie-parser');
const path       = require('path');

const { apiLimiter } = require('./middleware/rateLimiter.middleware');

const authRoutes    = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const cartRoutes    = require('./routes/cart.routes');
const orderRoutes   = require('./routes/order.routes');
const adminRoutes   = require('./routes/admin.routes');

const app = express();

// ─── Security Headers (Helmet) ───────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
            styleSrc:       ["'self'", "https://cdn.tailwindcss.com", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
            imgSrc:         ["'self'", "data:", "https:", "blob:"],
            connectSrc:     ["'self'"],
            fontSrc:        ["'self'", "https://cdnjs.cloudflare.com"],
            objectSrc:      ["'none'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    hsts: process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization']
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));               // Prevent large payload attacks
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());

// ─── Rate Limiting ───────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart',     cartRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/admin',    adminRoutes);

// ─── Static Frontend ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// SPA fallback — serve index.html for unknown routes
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
    } else {
        res.status(404).json({ error: 'Endpoint not found' });
    }
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[Server Error]', err.stack);
    // Never leak stack traces to client
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n  TechNest API  ─  http://localhost:${PORT}`);
    console.log(`  Environment:   ${process.env.NODE_ENV || 'development'}\n`);
});
