const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/rbac.middleware');
const { verifyCsrf } = require('../middleware/csrf.middleware');

// All admin routes: must be authenticated + admin role
router.use(verifyToken, requireAdmin);

// Dashboard
router.get('/dashboard',            ctrl.getDashboardStats);
router.get('/audit-logs',           ctrl.getAuditLogs);

// Product management
router.get('/products',             ctrl.getAllProducts);
router.post('/products',            verifyCsrf, ctrl.createProduct);
router.put('/products/:id',         verifyCsrf, ctrl.updateProduct);
router.delete('/products/:id',      verifyCsrf, ctrl.deleteProduct);

// User management
router.get('/users',                ctrl.getAllUsers);
router.patch('/users/:id/status',   verifyCsrf, ctrl.toggleUserStatus);

// Order management
router.get('/orders',               ctrl.getAllOrders);
router.patch('/orders/:id/status',  verifyCsrf, ctrl.updateOrderStatus);

module.exports = router;
