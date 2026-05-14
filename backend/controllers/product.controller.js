const db = require('../config/database');
const { sanitizeString } = require('../utils/validation');

// GET /api/products — public listing with search/filter
async function getProducts(req, res) {
    const { search, category, sort, page = 1, limit = 12 } = req.query;

    // Validate pagination — prevent resource exhaustion
    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
    const offset   = (pageNum - 1) * limitNum;

    // Allowed sort columns — whitelist to prevent SQL injection via ORDER BY
    const ALLOWED_SORTS = {
        'price_asc':  'p.price ASC',
        'price_desc': 'p.price DESC',
        'name_asc':   'p.name ASC',
        'newest':     'p.created_at DESC'
    };
    const orderBy = ALLOWED_SORTS[sort] || 'p.created_at DESC';

    const conditions = ['p.is_active = TRUE'];
    const params = [];

    if (search) {
        const safeSearch = sanitizeString(search).substring(0, 100);
        conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
        params.push(`%${safeSearch}%`, `%${safeSearch}%`);
    }

    if (category) {
        const safeCat = sanitizeString(category).substring(0, 50);
        conditions.push('p.category = ?');
        params.push(safeCat);
    }

    const whereClause = conditions.join(' AND ');

    try {
        // Count query — prepared statement
        const [countRows] = await db.execute(
            `SELECT COUNT(*) as total FROM products p WHERE ${whereClause}`,
            params
        );

        // Data query — ORDER BY uses whitelisted values (safe from injection)
        const [products] = await db.execute(
            `SELECT p.id, p.name, p.description, p.price, p.category, p.image_url, p.stock
             FROM products p
             WHERE ${whereClause}
             ORDER BY ${orderBy}
             LIMIT ${limitNum} OFFSET ${offset}`,
            params
        );

        res.json({
            products,
            pagination: {
                total: countRows[0].total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(countRows[0].total / limitNum)
            }
        });
    } catch (err) {
        console.error('[Products] getProducts error:', err.message);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
}

// GET /api/products/:id — single product
async function getProduct(req, res) {
    const id = parseInt(req.params.id);
    if (!id || id <= 0) return res.status(400).json({ error: 'Invalid product ID' });

    try {
        const [rows] = await db.execute(
            'SELECT id, name, description, price, category, image_url, stock FROM products WHERE id = ? AND is_active = TRUE',
            [id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Product not found' });
        res.json({ product: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch product' });
    }
}

// GET /api/products/categories
async function getCategories(req, res) {
    try {
        const [rows] = await db.execute(
            'SELECT DISTINCT category FROM products WHERE is_active = TRUE ORDER BY category'
        );
        res.json({ categories: rows.map(r => r.category) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
}

module.exports = { getProducts, getProduct, getCategories };
