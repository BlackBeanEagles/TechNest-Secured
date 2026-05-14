const router = require('express').Router();
const { getCart, addToCart, updateCartItem, removeFromCart, clearCart } = require('../controllers/cart.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { requireUser } = require('../middleware/rbac.middleware');
const { verifyCsrf } = require('../middleware/csrf.middleware');

router.use(verifyToken, requireUser); // All cart routes require auth

router.get('/',             getCart);
router.post('/',            verifyCsrf, addToCart);
router.put('/:id',          verifyCsrf, updateCartItem);
router.delete('/clear',     verifyCsrf, clearCart);
router.delete('/:id',       verifyCsrf, removeFromCart);

module.exports = router;
