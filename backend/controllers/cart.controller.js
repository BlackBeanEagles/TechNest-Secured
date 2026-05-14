const db = require('../config/database');
const { validateCartItem } = require('../utils/validation');

async function getCart(req, res) {
    try {
        // Prepared statement joins cart with products — user-scoped query
        const [items] = await db.execute(
            `SELECT c.id, c.quantity, c.product_id,
                    p.name, p.price, p.image_url, p.stock, p.is_active
             FROM cart c
             JOIN products p ON p.id = c.product_id
             WHERE c.user_id = ?
             ORDER BY c.created_at DESC`,
            [req.user.id]
        );

        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        res.json({ items, total: parseFloat(total.toFixed(2)) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch cart' });
    }
}

async function addToCart(req, res) {
    const errors = validateCartItem(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const product_id = parseInt(req.body.product_id);
    const quantity   = parseInt(req.body.quantity);

    try {
        // Verify product exists and has sufficient stock
        const [products] = await db.execute(
            'SELECT id, stock, is_active FROM products WHERE id = ? LIMIT 1',
            [product_id]
        );

        if (!products.length || !products[0].is_active) {
            return res.status(404).json({ error: 'Product not found' });
        }
        if (products[0].stock < quantity) {
            return res.status(400).json({ error: `Only ${products[0].stock} units available` });
        }

        // INSERT ... ON DUPLICATE KEY UPDATE — atomic upsert
        await db.execute(
            `INSERT INTO cart (user_id, product_id, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
            [req.user.id, product_id, quantity, quantity]
        );

        res.json({ message: 'Added to cart' });
    } catch (err) {
        console.error('[Cart] addToCart error:', err.message);
        res.status(500).json({ error: 'Failed to add to cart' });
    }
}

async function updateCartItem(req, res) {
    const item_id  = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity);

    if (!item_id || item_id <= 0) return res.status(400).json({ error: 'Invalid item ID' });
    if (!quantity || quantity < 1 || quantity > 9999) return res.status(400).json({ error: 'Invalid quantity' });

    try {
        // Ensure item belongs to this user — prevents IDOR
        const [items] = await db.execute(
            'SELECT c.id, p.stock FROM cart c JOIN products p ON p.id = c.product_id WHERE c.id = ? AND c.user_id = ?',
            [item_id, req.user.id]
        );

        if (!items.length) return res.status(404).json({ error: 'Cart item not found' });
        if (items[0].stock < quantity) return res.status(400).json({ error: `Only ${items[0].stock} units available` });

        await db.execute(
            'UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?',
            [quantity, item_id, req.user.id]
        );

        res.json({ message: 'Cart updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update cart' });
    }
}

async function removeFromCart(req, res) {
    const item_id = parseInt(req.params.id);
    if (!item_id || item_id <= 0) return res.status(400).json({ error: 'Invalid item ID' });

    try {
        // Scoped to user — prevents IDOR (Insecure Direct Object Reference)
        const [result] = await db.execute(
            'DELETE FROM cart WHERE id = ? AND user_id = ?',
            [item_id, req.user.id]
        );

        if (result.affectedRows === 0) return res.status(404).json({ error: 'Cart item not found' });
        res.json({ message: 'Item removed from cart' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove item' });
    }
}

async function clearCart(req, res) {
    try {
        await db.execute('DELETE FROM cart WHERE user_id = ?', [req.user.id]);
        res.json({ message: 'Cart cleared' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to clear cart' });
    }
}

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart };
