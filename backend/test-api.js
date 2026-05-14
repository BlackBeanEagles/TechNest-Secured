// Quick API test script — run with: node test-api.js
// Tests all major endpoints without needing Postman or any external tool
// Make sure the server is running first: npm run dev

const BASE = 'http://localhost:5000/api';

let cookieJar = ''; // stores cookies between requests
let csrfToken = '';

async function request(method, path, body, label) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookieJar)  headers['Cookie']        = cookieJar;
    if (csrfToken)  headers['X-CSRF-Token']  = csrfToken;

    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    // Save cookies from response
    const setCookie = res.headers.getSetCookie?.() || [];
    setCookie.forEach(c => {
        const name = c.split('=')[0];
        // Remove old value for this cookie name
        const parts = cookieJar.split('; ').filter(p => !p.startsWith(name + '='));
        const value = c.split(';')[0]; // name=value only
        parts.push(value);
        cookieJar = parts.filter(Boolean).join('; ');

        // Extract CSRF token
        if (name === 'csrf_token') {
            csrfToken = c.split('=')[1].split(';')[0];
        }
    });

    const data = await res.json().catch(() => ({}));
    const icon = res.ok ? '✅' : '❌';
    console.log(`\n${icon} [${res.status}] ${method} ${path} — ${label}`);
    if (!res.ok || process.env.VERBOSE) {
        console.log('   →', JSON.stringify(data).substring(0, 200));
    } else {
        const preview = Object.keys(data).slice(0,3).map(k => `${k}: ${JSON.stringify(data[k])?.substring(0,40)}`).join(', ');
        console.log('   →', preview || JSON.stringify(data).substring(0, 150));
    }
    return { res, data };
}

async function runTests() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  TechNest API Security Test Suite');
    console.log('═══════════════════════════════════════════════════');

    // ─── PUBLIC ROUTES ────────────────────────────────────────
    console.log('\n📦 PUBLIC ENDPOINTS');
    await request('GET', '/products',            null,            'Browse all products (public)');
    await request('GET', '/products/categories', null,            'Get categories (public)');
    await request('GET', '/products/1',          null,            'Single product (public)');
    await request('GET', '/products?search=MacBook', null,       'Search products');
    await request('GET', '/products?sort=price_asc', null,       'Sort products');

    // ─── AUTH: REGISTRATION ───────────────────────────────────
    console.log('\n🔐 AUTHENTICATION');
    await request('POST', '/auth/register', {
        username: 'testuser99',
        email:    'testuser99@example.com',
        password: 'Test@12345',
        first_name: 'Test', last_name: 'User'
    }, 'Register new user');

    // Duplicate registration
    await request('POST', '/auth/register', {
        username: 'testuser99', email: 'testuser99@example.com', password: 'Test@12345'
    }, 'Duplicate register → should fail 409');

    // Invalid password (missing special char)
    await request('POST', '/auth/register', {
        username: 'baduser', email: 'bad@example.com', password: 'weakpass'
    }, 'Weak password → should fail 400');

    // XSS in username
    await request('POST', '/auth/register', {
        username: '<script>alert(1)</script>', email: 'xss@x.com', password: 'Test@123'
    }, 'XSS in username → should fail 400 (regex blocks it)');

    // SQL injection in identifier
    await request('POST', '/auth/login', {
        identifier: "' OR '1'='1' --", password: 'anything'
    }, "SQL injection login → should fail 401 (prepared stmt)");

    // ─── AUTH: LOGIN ──────────────────────────────────────────
    console.log('\n🔑 LOGIN FLOW');
    await request('POST', '/auth/login', {
        identifier: 'admin', password: 'Admin@1234'
    }, 'Admin login → should succeed + set httpOnly cookie');

    await request('GET', '/auth/me', null, 'Get current user profile (admin)');

    // ─── ADMIN ENDPOINTS (with admin cookie) ─────────────────
    console.log('\n👑 ADMIN ENDPOINTS');
    await request('GET', '/admin/dashboard',  null, 'Dashboard stats');
    await request('GET', '/admin/users',      null, 'All users list');
    await request('GET', '/admin/products',   null, 'All products (admin view)');
    await request('GET', '/admin/orders',     null, 'All orders');
    await request('GET', '/admin/audit-logs', null, 'Audit log');

    // Create product
    const { data: newProd } = await request('POST', '/admin/products', {
        name: 'Test Product', description: 'A test item',
        price: 99.99, category: 'Test', stock: 10
    }, 'Create product (admin)');

    // ─── LOGOUT + SWITCH TO USER ──────────────────────────────
    console.log('\n🔄 SWITCH TO USER ROLE');
    await request('POST', '/auth/logout', {}, 'Admin logout');
    cookieJar = ''; csrfToken = '';

    await request('POST', '/auth/login', {
        identifier: 'johndoe', password: 'User@1234'
    }, 'User login');

    // ─── USER ENDPOINTS ───────────────────────────────────────
    console.log('\n🛒 USER ENDPOINTS');
    await request('GET',  '/cart', null, 'Get cart (empty)');
    await request('POST', '/cart', { product_id: 1, quantity: 2 }, 'Add MacBook to cart');
    await request('POST', '/cart', { product_id: 2, quantity: 1 }, 'Add iPhone to cart');
    await request('GET',  '/cart', null, 'View cart with items');

    // IDOR attempt — try to delete cart item 999 (belongs to no one/other user)
    await request('DELETE', '/cart/999', {}, 'IDOR: delete cart item not owned → should 404');

    await request('POST', '/orders', {
        shipping_address: '123 Test Street, New York, NY 10001'
    }, 'Place order');

    await request('GET', '/orders', null, 'View my orders');

    // ─── AUTHORIZATION BYPASS ATTEMPTS ───────────────────────
    console.log('\n🚫 AUTHORIZATION BYPASS TESTS');
    // User tries to access admin endpoint
    await request('GET',  '/admin/users',   null, 'User → admin endpoint → should 403');
    await request('POST', '/admin/products', { name:'hack', price:1, category:'x' }, 'User → create product → should 403');

    // ─── NO AUTH TESTS ────────────────────────────────────────
    console.log('\n🔒 UNAUTHENTICATED TESTS');
    cookieJar = ''; csrfToken = '';
    await request('GET',  '/cart',          null, 'No auth → cart → should 401');
    await request('GET',  '/admin/dashboard', null,'No auth → admin → should 401');
    await request('POST', '/orders',        {}, 'No auth → place order → should 401');

    // ─── INPUT VALIDATION EDGE CASES ─────────────────────────
    console.log('\n🧪 INPUT VALIDATION EDGE CASES');
    await request('GET', '/products?sort=DROP TABLE users;--', null, 'SQLi in sort → uses whitelist, safe');
    await request('GET', '/products?search=' + 'A'.repeat(200), null, 'Oversized search → truncated/rejected');
    await request('POST', '/auth/login', { identifier: 'x'.repeat(200), password: 'y' }, 'Oversized identifier → fail 400');

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  Tests complete! Check ✅/❌ above.');
    console.log('═══════════════════════════════════════════════════\n');
}

runTests().catch(err => {
    console.error('\n💥 Could not connect to server:', err.message);
    console.error('Make sure the backend is running: cd backend && npm run dev\n');
});
