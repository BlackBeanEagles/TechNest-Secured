const db = require('../config/database');
const { validateProduct, sanitizeString, PATTERNS } = require('../utils/validation');

// ─── Products ───────────────────────────────────────────────────────────────

async function getAllProducts(req, res) {
    const { search, category, page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (search) {
        conditions.push('(name LIKE ? OR description LIKE ?)');
        const s = sanitizeString(search).substring(0, 100);
        params.push(`%${s}%`, `%${s}%`);
    }
    if (category) {
        conditions.push('category = ?');
        params.push(sanitizeString(category).substring(0, 50));
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    try {
        const [countRows] = await db.execute(
            `SELECT COUNT(*) as total FROM products ${where}`, params
        );
        const [products] = await db.execute(
            `SELECT id, name, price, category, stock, is_active, created_at
             FROM products ${where}
             ORDER BY created_at DESC
             LIMIT ${limitNum} OFFSET ${offset}`,
            params
        );
        res.json({ products, total: countRows[0].total, page: pageNum, limit: limitNum });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch products' });
    }
}

async function createProduct(req, res) {
    const errors = validateProduct(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const { name, description, price, category, image_url, stock } = req.body;

    // Validate image_url format
    if (image_url && !/^https?:\/\/.{5,}/.test(image_url)) {
        return res.status(400).json({ error: 'Invalid image URL' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO products (name, description, price, category, image_url, stock, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                sanitizeString(name),
                description ? sanitizeString(description) : null,
                parseFloat(price),
                sanitizeString(category),
                image_url ? sanitizeString(image_url) : null,
                parseInt(stock) || 0,
                req.user.id
            ]
        );

        await db.execute(
            'INSERT INTO audit_logs (user_id, action, resource) VALUES (?, ?, ?)',
            [req.user.id, 'PRODUCT_CREATED', `product:${result.insertId}`]
        );

        res.status(201).json({ message: 'Product created', product_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create product' });
    }
}

async function updateProduct(req, res) {
    const id = parseInt(req.params.id);
    if (!id || id <= 0) return res.status(400).json({ error: 'Invalid product ID' });

    const errors = validateProduct(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const { name, description, price, category, image_url, stock, is_active } = req.body;

    if (image_url && !/^https?:\/\/.{5,}/.test(image_url)) {
        return res.status(400).json({ error: 'Invalid image URL' });
    }

    try {
        const [result] = await db.execute(
            `UPDATE products
             SET name = ?, description = ?, price = ?, category = ?,
                 image_url = ?, stock = ?, is_active = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                sanitizeString(name),
                description ? sanitizeString(description) : null,
                parseFloat(price),
                sanitizeString(category),
                image_url ? sanitizeString(image_url) : null,
                parseInt(stock) || 0,
                is_active !== undefined ? Boolean(is_active) : true,
                id
            ]
        );

        if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });

        await db.execute(
            'INSERT INTO audit_logs (user_id, action, resource) VALUES (?, ?, ?)',
            [req.user.id, 'PRODUCT_UPDATED', `product:${id}`]
        );

        res.json({ message: 'Product updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update product' });
    }
}

async function deleteProduct(req, res) {
    const id = parseInt(req.params.id);
    if (!id || id <= 0) return res.status(400).json({ error: 'Invalid product ID' });

    try {
        // Soft delete — preserve order history
        const [result] = await db.execute(
            'UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });

        await db.execute(
            'INSERT INTO audit_logs (user_id, action, resource) VALUES (?, ?, ?)',
            [req.user.id, 'PRODUCT_DELETED', `product:${id}`]
        );

        res.json({ message: 'Product deactivated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete product' });
    }
}

// ─── Users ───────────────────────────────────────────────────────────────────

async function getAllUsers(req, res) {
    const { search, page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (search) {
        const s = sanitizeString(search).substring(0, 100);
        conditions.push('(username LIKE ? OR email LIKE ?)');
        params.push(`%${s}%`, `%${s}%`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    try {
        const [countRows] = await db.execute(`SELECT COUNT(*) as total FROM users ${where}`, params);
        const [users] = await db.execute(
            `SELECT id, username, email, role, first_name, last_name, is_active,
                    failed_login_attempts, created_at
             FROM users ${where}
             ORDER BY created_at DESC
             LIMIT ${limitNum} OFFSET ${offset}`,
            params
        );
        res.json({ users, total: countRows[0].total });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
}

async function toggleUserStatus(req, res) {
    const id = parseInt(req.params.id);
    if (!id || id <= 0) return res.status(400).json({ error: 'Invalid user ID' });
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot modify your own account' });

    try {
        const [rows] = await db.execute('SELECT is_active FROM users WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ error: 'User not found' });

        const newStatus = !rows[0].is_active;
        await db.execute('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, id]);

        await db.execute(
            'INSERT INTO audit_logs (user_id, action, resource, details) VALUES (?, ?, ?, ?)',
            [req.user.id, newStatus ? 'USER_ENABLED' : 'USER_DISABLED', `user:${id}`, null]
        );

        res.json({ message: `User ${newStatus ? 'enabled' : 'disabled'}`, is_active: newStatus });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user status' });
    }
}

// ─── Orders ──────────────────────────────────────────────────────────────────

async function getAllOrders(req, res) {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * limitNum;

    const VALID_STATUSES = ['pending','processing','shipped','delivered','cancelled'];
    const conditions = [];
    const params = [];

    if (status && VALID_STATUSES.includes(status)) {
        conditions.push('o.status = ?');
        params.push(status);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    try {
        const [countRows] = await db.execute(`SELECT COUNT(*) as total FROM orders o ${where}`, params);
        const [orders] = await db.execute(
            `SELECT o.id, o.total, o.status, o.created_at,
                    u.username, u.email
             FROM orders o
             JOIN users u ON u.id = o.user_id
             ${where}
             ORDER BY o.created_at DESC
             LIMIT ${limitNum} OFFSET ${offset}`,
            params
        );
        res.json({ orders, total: countRows[0].total });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
}

async function updateOrderStatus(req, res) {
    const id = parseInt(req.params.id);
    if (!id || id <= 0) return res.status(400).json({ error: 'Invalid order ID' });

    const { status } = req.body;
    const VALID_STATUSES = ['pending','processing','shipped','delivered','cancelled'];

    if (!status || !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
    }

    try {
        const [result] = await db.execute(
            'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?',
            [status, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Order not found' });

        await db.execute(
            'INSERT INTO audit_logs (user_id, action, resource, details) VALUES (?, ?, ?, ?)',
            [req.user.id, 'ORDER_STATUS_UPDATED', `order:${id}`, JSON.stringify({ status })]
        );

        res.json({ message: 'Order status updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update order status' });
    }
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

async function getDashboardStats(req, res) {
    try {
        const [[{ totalUsers }]] = await db.execute('SELECT COUNT(*) as totalUsers FROM users');
        const [[{ totalProducts }]] = await db.execute('SELECT COUNT(*) as totalProducts FROM products WHERE is_active = TRUE');
        const [[{ totalOrders }]] = await db.execute('SELECT COUNT(*) as totalOrders FROM orders');
        const [[{ revenue }]] = await db.execute("SELECT COALESCE(SUM(total),0) as revenue FROM orders WHERE status != 'cancelled'");
        const [recentOrders] = await db.execute(
            `SELECT o.id, o.total, o.status, o.created_at, u.username
             FROM orders o JOIN users u ON u.id = o.user_id
             ORDER BY o.created_at DESC LIMIT 5`
        );

        res.json({ totalUsers, totalProducts, totalOrders, revenue, recentOrders });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
}

async function getAuditLogs(req, res) {
    const { page = 1, limit = 30 } = req.query;
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 30));
    const offset   = (pageNum - 1) * limitNum;

    try {
        const [logs] = await db.execute(
            `SELECT al.id, al.action, al.resource, al.ip_address, al.created_at, u.username
             FROM audit_logs al
             LEFT JOIN users u ON u.id = al.user_id
             ORDER BY al.created_at DESC
             LIMIT ${limitNum} OFFSET ${offset}`
        );
        res.json({ logs });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
}

module.exports = {
    getAllProducts, createProduct, updateProduct, deleteProduct,
    getAllUsers, toggleUserStatus,
    getAllOrders, updateOrderStatus,
    getDashboardStats, getAuditLogs
};
