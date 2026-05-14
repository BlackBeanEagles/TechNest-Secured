const db = require('../config/database');
const { validateOrder, sanitizeString } = require('../utils/validation');

async function placeOrder(req, res) {
    const errors = validateOrder(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const shipping_address = sanitizeString(req.body.shipping_address);
    const conn = await (require('../config/database')).getConnection();

    try {
        // Fetch cart items with current prices — use transaction for atomicity
        const [cartItems] = await conn.execute(
            `SELECT c.product_id, c.quantity, p.name, p.price, p.stock
             FROM cart c
             JOIN products p ON p.id = c.product_id
             WHERE c.user_id = ? AND p.is_active = TRUE`,
            [req.user.id]
        );

        if (!cartItems.length) {
            conn.release();
            return res.status(400).json({ error: 'Cart is empty' });
        }

        // Validate stock for all items before committing
        for (const item of cartItems) {
            if (item.stock < item.quantity) {
                conn.release();
                return res.status(400).json({
                    error: `Insufficient stock for "${item.name}". Available: ${item.stock}`
                });
            }
        }

        await conn.beginTransaction();

        const total = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

        // Create order — prepared statement
        const [orderResult] = await conn.execute(
            'INSERT INTO orders (user_id, total, shipping_address) VALUES (?, ?, ?)',
            [req.user.id, parseFloat(total.toFixed(2)), shipping_address]
        );

        const order_id = orderResult.insertId;

        // Insert order items + decrement stock
        for (const item of cartItems) {
            await conn.execute(
                'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)',
                [order_id, item.product_id, item.name, item.quantity, item.price]
            );
            // Atomic stock decrement with guard
            await conn.execute(
                'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
                [item.quantity, item.product_id, item.quantity]
            );
        }

        // Clear user cart
        await conn.execute('DELETE FROM cart WHERE user_id = ?', [req.user.id]);

        await conn.commit();
        conn.release();

        // Audit log
        await require('../config/database').execute(
            'INSERT INTO audit_logs (user_id, action, resource, details) VALUES (?, ?, ?, ?)',
            [req.user.id, 'ORDER_PLACED', `order:${order_id}`, JSON.stringify({ total, items: cartItems.length })]
        );

        res.status(201).json({ message: 'Order placed successfully', order_id, total });
    } catch (err) {
        await conn.rollback().catch(() => {});
        conn.release();
        console.error('[Order] placeOrder error:', err.message);
        res.status(500).json({ error: 'Failed to place order' });
    }
}

async function getOrders(req, res) {
    try {
        const [orders] = await db.execute(
            `SELECT id, total, status, shipping_address, created_at
             FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
            [req.user.id]
        );

        // Fetch items for each order
        for (const order of orders) {
            const [items] = await db.execute(
                'SELECT product_id, product_name, quantity, price FROM order_items WHERE order_id = ?',
                [order.id]
            );
            order.items = items;
        }

        res.json({ orders });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
}

async function getOrder(req, res) {
    const order_id = parseInt(req.params.id);
    if (!order_id || order_id <= 0) return res.status(400).json({ error: 'Invalid order ID' });

    try {
        // Scoped to current user — IDOR prevention
        const [rows] = await db.execute(
            'SELECT id, total, status, shipping_address, created_at FROM orders WHERE id = ? AND user_id = ?',
            [order_id, req.user.id]
        );

        if (!rows.length) return res.status(404).json({ error: 'Order not found' });

        const [items] = await db.execute(
            'SELECT product_id, product_name, quantity, price FROM order_items WHERE order_id = ?',
            [order_id]
        );

        res.json({ order: { ...rows[0], items } });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch order' });
    }
}

module.exports = { placeOrder, getOrders, getOrder };
