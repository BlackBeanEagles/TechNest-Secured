const router = require('express').Router();
const { placeOrder, getOrders, getOrder } = require('../controllers/order.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireUser } = require('../middleware/rbac.middleware');
const { verifyCsrf } = require('../middleware/csrf.middleware');

router.use(verifyToken, requireUser);

router.get('/',      getOrders);
router.get('/:id',   getOrder);
router.post('/',     verifyCsrf, placeOrder);

module.exports = router;
