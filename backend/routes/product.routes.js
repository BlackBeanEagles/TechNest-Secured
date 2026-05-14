const router = require('express').Router();
const { getProducts, getProduct, getCategories } = require('../controllers/product.controller');

// Public routes — no auth required
router.get('/',            getProducts);
router.get('/categories',  getCategories);
router.get('/:id',         getProduct);

module.exports = router;
