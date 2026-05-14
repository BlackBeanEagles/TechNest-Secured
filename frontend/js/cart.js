// Cart page logic

document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();
    await loadCart();
    setupCheckout();
});

async function loadCart() {
    const container = document.getElementById('cartItems');
    const empty     = document.getElementById('emptyCart');
    const summary   = document.getElementById('cartSummary');
    const loading   = document.getElementById('loadingCart');

    if (loading) loading.classList.remove('hidden');

    try {
        const res  = await apiFetch('/cart');
        if (!res) return;
        const data = await res.json();

        if (loading) loading.classList.add('hidden');

        if (!data.items?.length) {
            if (empty)   empty.classList.remove('hidden');
            if (summary) summary.classList.add('hidden');
            return;
        }

        if (empty)   empty.classList.add('hidden');
        if (summary) summary.classList.remove('hidden');
        if (container) container.innerHTML = '';

        for (const item of data.items) {
            container.appendChild(createCartRow(item));
        }

        updateSummary(data.total, data.items.length);
    } catch {
        if (loading) loading.classList.add('hidden');
        showToast('Failed to load cart', 'error');
    }
}

function createCartRow(item) {
    const row = document.createElement('div');
    row.id = `cart-item-${item.id}`;
    row.className = 'flex items-center gap-4 p-4 bg-gray-800 rounded-xl border border-gray-700';

    const img = document.createElement('img');
    img.className = 'w-20 h-20 object-cover rounded-lg flex-shrink-0';
    img.src = /^https?:\/\//.test(item.image_url || '') ? item.image_url : '';
    img.alt = '';
    img.onerror = () => { img.style.display = 'none'; };

    const info = document.createElement('div');
    info.className = 'flex-1 min-w-0';

    const name = document.createElement('h3');
    name.className = 'text-white font-semibold truncate';
    name.textContent = sanitizeText(item.name);

    const price = document.createElement('p');
    price.className = 'text-cyan-400 font-bold mt-1';
    price.textContent = formatPrice(item.price);

    const stock = document.createElement('p');
    stock.className = 'text-gray-400 text-xs mt-1';
    stock.textContent = `${item.stock} available`;

    info.append(name, price, stock);

    // Quantity controls
    const qtyWrapper = document.createElement('div');
    qtyWrapper.className = 'flex items-center gap-2';

    const minusBtn = document.createElement('button');
    minusBtn.className = 'w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors';
    minusBtn.textContent = '−';

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'w-16 text-center bg-gray-700 border border-gray-600 rounded-lg text-white py-1 font-medium';
    qtyInput.value = item.quantity;
    qtyInput.min = 1;
    qtyInput.max = Math.min(item.stock, 9999);

    // Validate quantity input — regex check on change
    qtyInput.addEventListener('change', () => {
        const val = parseInt(qtyInput.value);
        if (!/^[1-9]\d{0,3}$/.test(String(qtyInput.value)) || val < 1 || val > item.stock) {
            qtyInput.value = item.quantity;
            showToast(`Quantity must be 1 to ${item.stock}`, 'warning');
            return;
        }
        updateQuantity(item.id, val, row);
    });

    const plusBtn = document.createElement('button');
    plusBtn.className = 'w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors';
    plusBtn.textContent = '+';

    minusBtn.addEventListener('click', () => {
        const cur = parseInt(qtyInput.value);
        if (cur > 1) {
            qtyInput.value = cur - 1;
            updateQuantity(item.id, cur - 1, row);
        }
    });

    plusBtn.addEventListener('click', () => {
        const cur = parseInt(qtyInput.value);
        if (cur < item.stock && cur < 9999) {
            qtyInput.value = cur + 1;
            updateQuantity(item.id, cur + 1, row);
        }
    });

    qtyWrapper.append(minusBtn, qtyInput, plusBtn);

    // Item total
    const totalEl = document.createElement('div');
    totalEl.id = `item-total-${item.id}`;
    totalEl.className = 'text-white font-bold text-lg min-w-[80px] text-right';
    totalEl.textContent = formatPrice(item.price * item.quantity);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'text-red-400 hover:text-red-300 transition-colors ml-2';
    removeBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>';
    removeBtn.addEventListener('click', () => removeItem(item.id, row));

    row.append(img, info, qtyWrapper, totalEl, removeBtn);
    return row;
}

async function updateQuantity(itemId, quantity, row) {
    try {
        const res = await apiFetch(`/cart/${itemId}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity })
        });
        if (res && res.ok) {
            await reloadSummary();
        } else {
            const data = res ? await res.json() : {};
            showToast(sanitizeText(data.error || 'Update failed'), 'error');
        }
    } catch {
        showToast('Network error', 'error');
    }
}

async function removeItem(itemId, row) {
    try {
        const res = await apiFetch(`/cart/${itemId}`, { method: 'DELETE' });
        if (res && res.ok) {
            row.remove();
            showToast('Item removed', 'success');
            await reloadSummary();
        }
    } catch {
        showToast('Failed to remove item', 'error');
    }
}

async function reloadSummary() {
    try {
        const res  = await apiFetch('/cart');
        if (!res) return;
        const data = await res.json();

        if (!data.items?.length) {
            document.getElementById('cartItems')?.replaceChildren();
            document.getElementById('emptyCart')?.classList.remove('hidden');
            document.getElementById('cartSummary')?.classList.add('hidden');
        } else {
            updateSummary(data.total, data.items.length);
        }
    } catch {}
}

function updateSummary(total, count) {
    const totalEl = document.getElementById('cartTotal');
    const countEl = document.getElementById('itemCount');
    const taxEl   = document.getElementById('taxAmount');
    const grandEl = document.getElementById('grandTotal');

    if (countEl) countEl.textContent = `${count} item${count !== 1 ? 's' : ''}`;
    if (totalEl) totalEl.textContent = formatPrice(total);

    const tax   = total * 0.08;
    const grand = total + tax;
    if (taxEl)   taxEl.textContent   = formatPrice(tax);
    if (grandEl) grandEl.textContent = formatPrice(grand);
}

function setupCheckout() {
    const form      = document.getElementById('checkoutForm');
    const addrInput = document.getElementById('shippingAddress');

    if (!form || !addrInput) return;

    // Live validation on address field
    addrInput.addEventListener('blur', () => {
        const val = addrInput.value.trim();
        if (val.length < 10) {
            showFieldError(addrInput, 'Please enter a valid shipping address (min 10 characters)');
        } else if (val.length > 500) {
            showFieldError(addrInput, 'Address too long (max 500 characters)');
        } else {
            showFieldSuccess(addrInput);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const address = addrInput.value.trim();
        if (address.length < 10) {
            showFieldError(addrInput, 'Please enter a valid shipping address');
            return;
        }
        if (address.length > 500) {
            showFieldError(addrInput, 'Address too long');
            return;
        }

        const btn = document.getElementById('placeOrderBtn');
        btn.disabled = true;
        btn.textContent = 'Placing Order...';

        try {
            const res = await apiFetch('/orders', {
                method: 'POST',
                body: JSON.stringify({ shipping_address: sanitizeText(address) })
            });

            const data = res ? await res.json() : {};

            if (res && res.ok) {
                showToast(`Order #${data.order_id} placed successfully!`, 'success');
                setTimeout(() => window.location.href = '/orders.html', 1500);
            } else {
                showToast(sanitizeText(data.error || 'Order failed'), 'error');
                btn.disabled = false;
                btn.textContent = 'Place Order';
            }
        } catch {
            showToast('Network error', 'error');
            btn.disabled = false;
            btn.textContent = 'Place Order';
        }
    });
}
