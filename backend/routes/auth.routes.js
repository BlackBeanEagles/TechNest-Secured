const router = require('express').Router();
const { register, login, logout, me, refreshToken, updateProfile } = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { verifyCsrf } = require('../middleware/csrf.middleware');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiter.middleware');

router.post('/register', registerLimiter, register);
router.post('/login',    authLimiter, login);
router.post('/logout',   verifyToken, verifyCsrf, logout);
router.post('/refresh',  refreshToken);

router.get('/me',        verifyToken, me);
router.put('/profile',   verifyToken, verifyCsrf, updateProfile);

module.exports = router;
