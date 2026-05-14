// Products listing logic for index.html

let currentPage = 1;
let currentSearch = '';
let currentCategory = '';
let currentSort = 'newest';

document.addEventListener('DOMContentLoaded', async () => {
    updateNavbar();
    await loadCategories();
    await loadProducts();
    setupSearch();
    setupFilters();
});

function updateNavbar() {
    const user = getCurrentUser();
    const navAuth  = document.getElementById('navAuth');
    const navUser  = document.getElementById('navUser');
    const navAdmin = document.getElementById('navAdmin');

    if (user) {
        if (navAuth)  navAuth.classList.add('hidden');
        if (navUser) {
            navUser.classList.remove('hidden');
            const nameEl = document.getElementById('navUsername');
            if (nameEl) nameEl.textContent = sanitizeText(user.username);
        }
        if (navAdmin && user.role === 'admin') navAdmin.classList.remove('hidden');
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await apiFetch('/auth/logout', { method: 'POST' });
            clearCurrentUser();
            window.location.href = '/login.html';
        });
    }

    const cartCount = document.getElementById('cartCount');
    if (cartCount && user) loadCartCount();
}

async function loadCartCount() {
    try {
        const res = await apiFetch('/cart');
        if (res && res.ok) {
            const data = await res.json();
            const count = data.items?.length || 0;
            const el = document.getElementById('cartCount');
            if (el) {
                el.textContent = count;
                el.classList.toggle('hidden', count === 0);
            }
        }
    } catch {}
}

async function loadCategories() {
    try {
        const res = await fetch('/api/products/categories');
        const data = await res.json();
        const container = document.getElementById('categoryFilters');
        if (!container) return;

        const allBtn = createCategoryBtn('All', '');
        container.appendChild(allBtn);

        for (const cat of (data.categories || [])) {
            container.appendChild(createCategoryBtn(sanitizeText(cat), cat));
        }
    } catch {}
}

function createCategoryBtn(label, value) {
    const btn = document.createElement('button');
    btn.className = `category-btn px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                     border border-gray-700 text-gray-300 hover:border-cyan-500 hover:text-cyan-400
                     ${value === currentCategory ? 'bg-cyan-600 border-cyan-600 text-white' : ''}`;
    btn.textContent = label; // textContent — XSS safe
    btn.addEventListener('click', () => {
        currentCategory = value;
        currentPage = 1;
        document.querySelectorAll('.category-btn').forEach(b => {
            b.classList.remove('bg-cyan-600', 'border-cyan-600', 'text-white');
            b.classList.add('border-gray-700', 'text-gray-300');
        });
        btn.classList.add('bg-cyan-600', 'border-cyan-600', 'text-white');
        btn.classList.remove('border-gray-700', 'text-gray-300');
        loadProducts();
    });
    return btn;
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn   = document.getElementById('searchBtn');
    if (!searchInput) return;

    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        // Validate search input with regex — only allow safe characters
        const raw = searchInput.value;
        const safeSearch = raw.replace(/[<>'";&]/g, ''); // Strip dangerous chars
        if (raw !== safeSearch) searchInput.value = safeSearch;

        debounceTimer = setTimeout(() => {
            currentSearch = safeSearch.trim();
            currentPage = 1;
            loadProducts();
        }, 400);
    });

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            currentSearch = searchInput.value.trim().replace(/[<>'";&]/g, '');
            currentPage = 1;
            loadProducts();
        });
    }
}

function setupFilters() {
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        // Whitelist valid sort values
        const VALID_SORTS = ['newest', 'price_asc', 'price_desc', 'name_asc'];
        sortSelect.addEventListener('change', () => {
            if (VALID_SORTS.includes(sortSelect.value)) {
                currentSort = sortSelect.value;
                currentPage = 1;
                loadProducts();
            }
        });
    }
}

async function loadProducts() {
    const grid    = document.getElementById('productsGrid');
    const loading = document.getElementById('loadingState');
    const empty   = document.getElementById('emptyState');

    if (!grid) return;

    if (loading) loading.classList.remove('hidden');
    grid.innerHTML = '';
    if (empty) empty.classList.add('hidden');

    try {
        const params = new URLSearchParams({
            page:     currentPage,
            limit:    12,
            sort:     currentSort,
            ...(currentSearch  ? { search: currentSearch }    : {}),
            ...(currentCategory ? { category: currentCategory } : {})
        });

        const res  = await fetch(`/api/products?${params}`);
        const data = await res.json();

        if (loading) loading.classList.add('hidden');

        if (!data.products?.length) {
            if (empty) empty.classList.remove('hidden');
            return;
        }

        for (const product of data.products) {
            grid.appendChild(createProductCard(product));
        }

        renderPagination(data.pagination);

    } catch {
        if (loading) loading.classList.add('hidden');
        grid.innerHTML = '<p class="text-gray-400 text-center col-span-full">Failed to load products.</p>';
    }
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card bg-gray-800 rounded-xl overflow-hidden border border-gray-700 ' +
                     'hover:border-cyan-500 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 flex flex-col';

    // Use textContent for all dynamic data — XSS prevention
    const img = document.createElement('img');
    img.className = 'w-full h-48 object-cover';
    img.src = /^https?:\/\//.test(product.image_url || '') ? product.image_url : '/img/placeholder.jpg';
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = () => { img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect fill="%23374151" width="400" height="200"/><text x="50%" y="50%" fill="%236B7280" text-anchor="middle" dy=".3em">No Image</text></svg>'; };

    const body = document.createElement('div');
    body.className = 'p-5 flex flex-col flex-1';

    const category = document.createElement('span');
    category.className = 'text-xs text-cyan-400 font-medium uppercase tracking-wide mb-2';
    category.textContent = sanitizeText(product.category); // DOMPurify text sanitization

    const name = document.createElement('h3');
    name.className = 'text-white font-semibold text-lg mb-2 line-clamp-2';
    name.textContent = sanitizeText(product.name);

    const desc = document.createElement('p');
    desc.className = 'text-gray-400 text-sm line-clamp-2 flex-1 mb-4';
    // sanitizeRich for description — allows limited HTML formatting
    desc.innerHTML = sanitizeRich(product.description || '');

    const footer = document.createElement('div');
    footer.className = 'flex items-center justify-between mt-auto';

    const priceEl = document.createElement('span');
    priceEl.className = 'text-2xl font-bold text-cyan-400';
    priceEl.textContent = formatPrice(product.price);

    const stockEl = document.createElement('span');
    stockEl.className = `text-xs px-2 py-1 rounded-full font-medium ${
        product.stock > 10 ? 'bg-green-900 text-green-400' :
        product.stock > 0  ? 'bg-yellow-900 text-yellow-400' : 'bg-red-900 text-red-400'
    }`;
    stockEl.textContent = product.stock > 0 ? `${product.stock} left` : 'Out of stock';

    footer.appendChild(priceEl);
    footer.appendChild(stockEl);

    const addBtn = document.createElement('button');
    addBtn.className = `mt-4 w-full py-2.5 rounded-lg font-semibold transition-all duration-200
                        ${product.stock > 0
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`;
    addBtn.textContent = product.stock > 0 ? 'Add to Cart' : 'Out of Stock';
    addBtn.disabled = product.stock === 0;

    if (product.stock > 0) {
        addBtn.addEventListener('click', () => addToCart(product.id, addBtn));
    }

    body.append(category, name, desc, footer, addBtn);
    card.append(img, body);

    return card;
}

async function addToCart(productId, btn) {
    if (!getCurrentUser()) {
        showToast('Please login to add items to cart', 'info');
        setTimeout(() => window.location.href = '/login.html', 1000);
        return;
    }

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Adding...';

    try {
        const res = await apiFetch('/cart', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId, quantity: 1 })
        });

        if (res && res.ok) {
            showToast('Added to cart!', 'success');
            loadCartCount();
            btn.textContent = 'Added!';
            btn.classList.add('bg-green-600');
            btn.classList.remove('bg-cyan-600');
            setTimeout(() => {
                btn.textContent = original;
                btn.disabled = false;
                btn.classList.remove('bg-green-600');
                btn.classList.add('bg-cyan-600');
            }, 1500);
        } else {
            const data = res ? await res.json() : {};
            showToast(data.error || 'Failed to add to cart', 'error');
            btn.disabled = false;
            btn.textContent = original;
        }
    } catch {
        showToast('Network error', 'error');
        btn.disabled = false;
        btn.textContent = original;
    }
}

function renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if (!container || !pagination) return;
    container.innerHTML = '';
    if (pagination.pages <= 1) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center gap-2';

    const prevBtn = createPageBtn('←', currentPage > 1, () => {
        currentPage--;
        loadProducts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    wrapper.appendChild(prevBtn);

    for (let i = 1; i <= pagination.pages; i++) {
        const btn = createPageBtn(String(i), true, () => {
            currentPage = i;
            loadProducts();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        if (i === currentPage) {
            btn.classList.add('bg-cyan-600', 'border-cyan-600', 'text-white');
            btn.classList.remove('border-gray-600', 'text-gray-300');
        }
        wrapper.appendChild(btn);
    }

    const nextBtn = createPageBtn('→', currentPage < pagination.pages, () => {
        currentPage++;
        loadProducts();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    wrapper.appendChild(nextBtn);
    container.appendChild(wrapper);
}

function createPageBtn(label, enabled, onClick) {
    const btn = document.createElement('button');
    btn.className = `px-3 py-1.5 rounded border text-sm font-medium transition-all
                     ${enabled
                         ? 'border-gray-600 text-gray-300 hover:border-cyan-500 hover:text-cyan-400 cursor-pointer'
                         : 'border-gray-700 text-gray-600 cursor-not-allowed'}`;
    btn.textContent = label;
    btn.disabled = !enabled;
    if (enabled) btn.addEventListener('click', onClick);
    return btn;
}
