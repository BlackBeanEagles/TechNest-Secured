// Admin dashboard logic

let currentTab = 'dashboard';

document.addEventListener('DOMContentLoaded', async () => {
    const user = requireAdmin();
    if (!user) return;

    document.getElementById('adminUsername').textContent = sanitizeText(user.username);
    setupTabs();
    setupLogout();
    await loadTab('dashboard');
});

function setupLogout() {
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await apiFetch('/auth/logout', { method: 'POST' });
        clearCurrentUser();
        window.location.href = '/login.html';
    });
}

function setupTabs() {
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('[data-tab]').forEach(b => {
        b.classList.toggle('bg-cyan-600',   b.dataset.tab === tab);
        b.classList.toggle('text-white',     b.dataset.tab === tab);
        b.classList.toggle('text-gray-400',  b.dataset.tab !== tab);
    });
    document.querySelectorAll('[data-panel]').forEach(p => {
        p.classList.toggle('hidden', p.dataset.panel !== tab);
    });
    loadTab(tab);
}

async function loadTab(tab) {
    switch (tab) {
        case 'dashboard': return loadDashboard();
        case 'products':  return loadAdminProducts();
        case 'users':     return loadUsers();
        case 'orders':    return loadAdminOrders();
        case 'audit':     return loadAuditLogs();
    }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const res  = await apiFetch('/admin/dashboard');
        if (!res || !res.ok) return;
        const data = await res.json();

        setStatCard('statUsers',    data.totalUsers);
        setStatCard('statProducts', data.totalProducts);
        setStatCard('statOrders',   data.totalOrders);
        setStatCard('statRevenue',  formatPrice(data.revenue));

        const tbody = document.getElementById('recentOrdersBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        for (const order of (data.recentOrders || [])) {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-700';
            tr.innerHTML = `
                <td class="py-3 px-4 text-gray-300">#${order.id}</td>
                <td class="py-3 px-4 text-white font-medium"></td>
                <td class="py-3 px-4 text-cyan-400 font-bold"></td>
                <td class="py-3 px-4"></td>
                <td class="py-3 px-4 text-gray-400 text-sm"></td>`;

            // Use textContent for dynamic data — XSS safe
            tr.cells[1].textContent = sanitizeText(order.username);
            tr.cells[2].textContent = formatPrice(order.total);
            tr.cells[3].innerHTML   = statusBadge(order.status);
            tr.cells[4].textContent = formatDate(order.created_at);
            tbody.appendChild(tr);
        }
    } catch {}
}

function setStatCard(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
}

// ─── Products (Admin) ─────────────────────────────────────────────────────────
let productPage = 1;

async function loadAdminProducts(search = '') {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-400">Loading...</td></tr>';

    try {
        const params = new URLSearchParams({ page: productPage, limit: 15, ...(search ? { search } : {}) });
        const res    = await apiFetch(`/admin/products?${params}`);
        if (!res || !res.ok) return;
        const data   = await res.json();

        tbody.innerHTML = '';

        if (!data.products?.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-400">No products found.</td></tr>';
            return;
        }

        for (const p of data.products) {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-700 hover:bg-gray-700/50';
            tr.innerHTML = `
                <td class="py-3 px-4 text-gray-400">#${p.id}</td>
                <td class="py-3 px-4 text-white font-medium"></td>
                <td class="py-3 px-4 text-gray-300"></td>
                <td class="py-3 px-4 text-cyan-400 font-bold"></td>
                <td class="py-3 px-4 text-gray-300"></td>
                <td class="py-3 px-4">
                    <button class="edit-product-btn text-blue-400 hover:text-blue-300 mr-3 text-sm" data-id="${p.id}">Edit</button>
                    <button class="delete-product-btn text-red-400 hover:text-red-300 text-sm" data-id="${p.id}">Remove</button>
                </td>`;

            tr.cells[1].textContent = sanitizeText(p.name);
            tr.cells[2].textContent = sanitizeText(p.category);
            tr.cells[3].textContent = formatPrice(p.price);
            tr.cells[4].textContent = `${p.stock} units`;

            tr.querySelector('.edit-product-btn').addEventListener('click', () => openEditProductModal(p.id));
            tr.querySelector('.delete-product-btn').addEventListener('click', () => deactivateProduct(p.id, tr));
            tbody.appendChild(tr);
        }
    } catch {}
}

async function openEditProductModal(id) {
    const res  = await fetch(`/api/products/${id}`);
    if (!res.ok) return showToast('Product not found', 'error');
    const data = await res.json();
    const p    = data.product;
    openProductModal(p);
}

function openProductModal(product = null) {
    const modal = document.getElementById('productModal');
    const form  = document.getElementById('productForm');
    const title = document.getElementById('modalTitle');
    if (!modal || !form) return;

    title.textContent = product ? 'Edit Product' : 'Add Product';
    form.reset();

    if (product) {
        document.getElementById('prodId').value          = product.id;
        document.getElementById('prodName').value        = sanitizeText(product.name);
        document.getElementById('prodCategory').value   = sanitizeText(product.category);
        document.getElementById('prodPrice').value      = product.price;
        document.getElementById('prodStock').value      = product.stock;
        document.getElementById('prodImageUrl').value   = sanitizeText(product.image_url || '');
        document.getElementById('prodDescription').value = sanitizeText(product.description || '');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

document.getElementById('addProductBtn')?.addEventListener('click', () => openProductModal());
document.getElementById('closeProductModal')?.addEventListener('click', () => {
    document.getElementById('productModal')?.classList.add('hidden');
    document.getElementById('productModal')?.classList.remove('flex');
});

document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fields = [
        { el: document.getElementById('prodName'),     type: 'username',  customValidator: (v) => v.length < 2 || v.length > 100 ? 'Name must be 2-100 characters' : null },
        { el: document.getElementById('prodCategory'), type: 'category' },
        { el: document.getElementById('prodPrice'),    type: 'price' },
        { el: document.getElementById('prodStock'),    customValidator: (v) => (parseInt(v) < 0 || isNaN(parseInt(v))) ? 'Stock must be 0 or more' : null }
    ];

    const urlEl = document.getElementById('prodImageUrl');
    if (urlEl.value && !/^https?:\/\/.{5,}/.test(urlEl.value)) {
        showFieldError(urlEl, 'Must be a valid https:// URL');
        return;
    }

    const errors = validateForm(fields);
    if (errors.length) return;

    const id = document.getElementById('prodId').value;
    const payload = {
        name:        sanitizeText(document.getElementById('prodName').value.trim()),
        description: sanitizeText(document.getElementById('prodDescription').value.trim()),
        price:       parseFloat(document.getElementById('prodPrice').value),
        category:    sanitizeText(document.getElementById('prodCategory').value.trim()),
        stock:       parseInt(document.getElementById('prodStock').value),
        image_url:   sanitizeText(document.getElementById('prodImageUrl').value.trim()) || null,
        is_active:   true
    };

    const endpoint = id ? `/admin/products/${id}` : '/admin/products';
    const method   = id ? 'PUT' : 'POST';

    const res  = await apiFetch(endpoint, { method, body: JSON.stringify(payload) });
    const data = res ? await res.json() : {};

    if (res && res.ok) {
        showToast(id ? 'Product updated!' : 'Product created!', 'success');
        document.getElementById('productModal').classList.add('hidden');
        document.getElementById('productModal').classList.remove('flex');
        loadAdminProducts();
    } else {
        const msg = Array.isArray(data.errors) ? data.errors.join(', ') : (data.error || 'Failed');
        showToast(sanitizeText(msg), 'error');
    }
});

async function deactivateProduct(id, row) {
    if (!confirm('Deactivate this product? It will be hidden from the store.')) return;
    const res = await apiFetch(`/admin/products/${id}`, { method: 'DELETE' });
    if (res && res.ok) {
        row.remove();
        showToast('Product deactivated', 'success');
    } else {
        showToast('Failed to deactivate product', 'error');
    }
}

// ─── Users ────────────────────────────────────────────────────────────────────
async function loadUsers(search = '') {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-400">Loading...</td></tr>';

    try {
        const params = new URLSearchParams({ page: 1, limit: 20, ...(search ? { search } : {}) });
        const res    = await apiFetch(`/admin/users?${params}`);
        if (!res || !res.ok) return;
        const data   = await res.json();

        tbody.innerHTML = '';
        if (!data.users?.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-400">No users found.</td></tr>';
            return;
        }

        for (const u of data.users) {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-700 hover:bg-gray-700/50';
            tr.innerHTML = `
                <td class="py-3 px-4 text-gray-400">#${u.id}</td>
                <td class="py-3 px-4 text-white font-medium"></td>
                <td class="py-3 px-4 text-gray-300"></td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded text-xs font-bold ${u.role === 'admin' ? 'bg-purple-900 text-purple-300' : 'bg-gray-700 text-gray-300'}">${u.role.toUpperCase()}</span></td>
                <td class="py-3 px-4"></td>
                <td class="py-3 px-4">
                    <button class="toggle-user-btn text-sm font-medium ${u.is_active ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'}" data-id="${u.id}" data-active="${u.is_active}">
                        ${u.is_active ? 'Disable' : 'Enable'}
                    </button>
                </td>`;

            tr.cells[1].textContent = sanitizeText(u.username);
            tr.cells[2].textContent = sanitizeText(u.email);
            tr.cells[4].innerHTML = u.is_active
                ? '<span class="px-2 py-0.5 rounded-full text-xs bg-green-900 text-green-400">Active</span>'
                : '<span class="px-2 py-0.5 rounded-full text-xs bg-red-900 text-red-400">Disabled</span>';

            tr.querySelector('.toggle-user-btn').addEventListener('click', (e) => {
                toggleUser(u.id, tr);
            });
            tbody.appendChild(tr);
        }
    } catch {}
}

async function toggleUser(id, row) {
    const res  = await apiFetch(`/admin/users/${id}/status`, { method: 'PATCH' });
    const data = res ? await res.json() : {};
    if (res && res.ok) {
        showToast(`User ${data.is_active ? 'enabled' : 'disabled'}`, 'success');
        loadUsers();
    } else {
        showToast(sanitizeText(data.error || 'Failed'), 'error');
    }
}

// ─── Orders ───────────────────────────────────────────────────────────────────
async function loadAdminOrders(status = '') {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-400">Loading...</td></tr>';

    try {
        const params = new URLSearchParams({ page: 1, limit: 20, ...(status ? { status } : {}) });
        const res    = await apiFetch(`/admin/orders?${params}`);
        if (!res || !res.ok) return;
        const data   = await res.json();

        tbody.innerHTML = '';
        if (!data.orders?.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-gray-400">No orders found.</td></tr>';
            return;
        }

        const VALID_STATUSES = ['pending','processing','shipped','delivered','cancelled'];

        for (const o of data.orders) {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-700 hover:bg-gray-700/50';

            const select = document.createElement('select');
            select.className = 'bg-gray-700 border border-gray-600 rounded text-white text-sm px-2 py-1';
            VALID_STATUSES.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
                opt.selected = s === o.status;
                select.appendChild(opt);
            });

            select.addEventListener('change', async () => {
                // Whitelist validation before sending
                if (!VALID_STATUSES.includes(select.value)) {
                    showToast('Invalid status', 'error');
                    return;
                }
                const res = await apiFetch(`/admin/orders/${o.id}/status`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: select.value })
                });
                if (res && res.ok) {
                    showToast('Order status updated', 'success');
                } else {
                    showToast('Failed to update status', 'error');
                }
            });

            tr.innerHTML = `
                <td class="py-3 px-4 text-gray-400">#${o.id}</td>
                <td class="py-3 px-4 text-white"></td>
                <td class="py-3 px-4 text-gray-300"></td>
                <td class="py-3 px-4 text-cyan-400 font-bold"></td>
                <td class="py-3 px-4"></td>
                <td class="py-3 px-4 text-gray-400 text-sm"></td>`;

            tr.cells[1].textContent = sanitizeText(o.username);
            tr.cells[2].textContent = sanitizeText(o.email);
            tr.cells[3].textContent = formatPrice(o.total);
            tr.cells[4].appendChild(select);
            tr.cells[5].textContent = formatDate(o.created_at);
            tbody.appendChild(tr);
        }
    } catch {}
}

// Order status filter
document.getElementById('orderStatusFilter')?.addEventListener('change', (e) => {
    const VALID = ['', 'pending','processing','shipped','delivered','cancelled'];
    if (VALID.includes(e.target.value)) loadAdminOrders(e.target.value);
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────
async function loadAuditLogs() {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-gray-400">Loading...</td></tr>';

    try {
        const res  = await apiFetch('/admin/audit-logs?limit=50');
        if (!res || !res.ok) return;
        const data = await res.json();

        tbody.innerHTML = '';
        for (const log of (data.logs || [])) {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-700';
            tr.innerHTML = `
                <td class="py-2 px-4 text-gray-400 text-sm"></td>
                <td class="py-2 px-4 text-white font-mono text-sm"></td>
                <td class="py-2 px-4 text-gray-300 text-sm"></td>
                <td class="py-2 px-4 text-gray-400 text-sm"></td>
                <td class="py-2 px-4 text-gray-500 text-xs"></td>`;

            tr.cells[0].textContent = sanitizeText(log.username || 'System');
            tr.cells[1].textContent = sanitizeText(log.action);
            tr.cells[2].textContent = sanitizeText(log.resource || '—');
            tr.cells[3].textContent = sanitizeText(log.ip_address || '—');
            tr.cells[4].textContent = formatDate(log.created_at);
            tbody.appendChild(tr);
        }
    } catch {}
}

// ─── Search handlers ──────────────────────────────────────────────────────────
document.getElementById('productSearchInput')?.addEventListener('input', (e) => {
    const val = e.target.value.replace(/[<>'";&]/g, '');
    e.target.value = val;
    clearTimeout(window._prodSearchTimer);
    window._prodSearchTimer = setTimeout(() => loadAdminProducts(val.trim()), 400);
});

document.getElementById('userSearchInput')?.addEventListener('input', (e) => {
    const val = e.target.value.replace(/[<>'";&]/g, '');
    e.target.value = val;
    clearTimeout(window._userSearchTimer);
    window._userSearchTimer = setTimeout(() => loadUsers(val.trim()), 400);
});

function statusBadge(status) {
    const colors = {
        pending:    'bg-yellow-900 text-yellow-400',
        processing: 'bg-blue-900 text-blue-400',
        shipped:    'bg-indigo-900 text-indigo-400',
        delivered:  'bg-green-900 text-green-400',
        cancelled:  'bg-red-900 text-red-400'
    };
    const color = colors[status] || 'bg-gray-700 text-gray-400';
    const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
    return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${color}">${escapeHtml(label)}</span>`;
}
