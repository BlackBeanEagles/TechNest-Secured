// API base URL — adjust to match your backend
const API_BASE = '/api';

// Read CSRF token from cookie (set by server on login)
function getCsrfToken() {
    const match = document.cookie.split(';').find(c => c.trim().startsWith('csrf_token='));
    return match ? match.trim().slice('csrf_token='.length) : '';
}

// Central fetch wrapper — automatically attaches CSRF token and handles auth errors
async function apiFetch(endpoint, options = {}) {
    const isStateChanging = options.method && options.method !== 'GET';
    const headers = {
        'Content-Type': 'application/json',
        ...(isStateChanging ? { 'X-CSRF-Token': getCsrfToken() } : {}),
        ...(options.headers || {})
    };

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
            credentials: 'include'   // Send httpOnly cookies
        });

        if (res.status === 401) {
            // Try token refresh once
            const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                credentials: 'include'
            });
            if (refreshed.ok) {
                // Retry original request
                return fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'include' });
            }
            // Refresh failed — redirect to login
            sessionStorage.setItem('redirect_after_login', window.location.pathname);
            window.location.href = '/login.html';
            return null;
        }

        return res;
    } catch (err) {
        console.error('Network error:', err);
        throw err;
    }
}

// Store minimal user info in sessionStorage (non-sensitive only)
function setCurrentUser(user) {
    sessionStorage.setItem('user', JSON.stringify({
        id: user.id,
        username: user.username,
        role: user.role
    }));
}

function getCurrentUser() {
    try {
        return JSON.parse(sessionStorage.getItem('user'));
    } catch { return null; }
}

function clearCurrentUser() {
    sessionStorage.removeItem('user');
}

function requireAuth(redirectTo = '/login.html') {
    const user = getCurrentUser();
    if (!user) {
        sessionStorage.setItem('redirect_after_login', window.location.pathname);
        window.location.href = redirectTo;
        return null;
    }
    return user;
}

function requireAdmin() {
    const user = requireAuth();
    if (user && user.role !== 'admin') {
        window.location.href = '/index.html';
        return null;
    }
    return user;
}

function showToast(message, type = 'success') {
    const existing = document.getElementById('toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toast';
    const colors = {
        success: 'bg-green-600',
        error:   'bg-red-600',
        info:    'bg-blue-600',
        warning: 'bg-yellow-600'
    };
    toast.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg text-white font-medium shadow-xl
                       ${colors[type] || colors.success} transition-all duration-300`;
    toast.textContent = message;  // textContent — safe from XSS (no innerHTML)
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function formatPrice(price) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

// Safe text renderer — uses DOM API instead of innerHTML to prevent XSS
function safeText(element, text) {
    element.textContent = String(text);
}
