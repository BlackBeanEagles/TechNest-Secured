// Frontend Validation — mix of DOMPurify (HTML sanitization) + Regex (input validation)
// DOMPurify: sanitizes HTML content rendered into DOM
// Regex: validates input format before submission

// ─── Regex Patterns ───────────────────────────────────────────────────────────
const VALIDATORS = {
    username: {
        regex: /^[a-zA-Z0-9_]{3,50}$/,
        message: 'Username: 3-50 characters, letters, numbers, underscore only'
    },
    email: {
        regex: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
        message: 'Please enter a valid email address'
    },
    password: {
        regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+[\]{};:'",.<>\/\\|`~])[A-Za-z\d@$!%*?&#^()\-_=+[\]{};:'",.<>\/\\|`~]{8,128}$/,
        message: 'Password must be 8+ characters with uppercase, lowercase, number, and special character'
    },
    name: {
        regex: /^[a-zA-Z\s'\-]{1,50}$/,
        message: 'Name: letters, spaces, hyphens, apostrophes only (max 50)'
    },
    phone: {
        regex: /^\+?[\d\s\-()\[\]]{7,20}$/,
        message: 'Phone: 7-20 digits, spaces, +, -, () allowed'
    },
    price: {
        regex: /^\d{1,8}(\.\d{1,2})?$/,
        message: 'Price: numbers only, up to 2 decimal places'
    },
    quantity: {
        regex: /^[1-9]\d{0,3}$/,
        message: 'Quantity: 1-9999'
    },
    category: {
        regex: /^[a-zA-Z\s&\-]{2,50}$/,
        message: 'Category: 2-50 characters, letters and spaces only'
    },
    url: {
        regex: /^https?:\/\/.{5,500}$/,
        message: 'Must be a valid http/https URL'
    }
};

// ─── Core Validator ────────────────────────────────────────────────────────────
function validateField(value, type) {
    const validator = VALIDATORS[type];
    if (!validator) return null;
    if (!value || String(value).trim() === '') return `${type} is required`;
    if (!validator.regex.test(String(value).trim())) return validator.message;
    return null;
}

// ─── Form Validation ──────────────────────────────────────────────────────────
function showFieldError(inputEl, message) {
    clearFieldError(inputEl);
    inputEl.classList.add('border-red-500', 'focus:ring-red-500');
    inputEl.classList.remove('border-gray-600');
    const err = document.createElement('p');
    err.className = 'field-error text-red-400 text-xs mt-1';
    err.textContent = message; // textContent — XSS safe
    inputEl.parentNode.insertBefore(err, inputEl.nextSibling);
}

function clearFieldError(inputEl) {
    const existing = inputEl.parentNode.querySelector('.field-error');
    if (existing) existing.remove();
    inputEl.classList.remove('border-red-500', 'focus:ring-red-500');
    inputEl.classList.add('border-gray-600');
}

function showFieldSuccess(inputEl) {
    clearFieldError(inputEl);
    inputEl.classList.add('border-green-500');
    inputEl.classList.remove('border-gray-600');
}

// Attach live validation to an input
function attachLiveValidation(inputEl, type, options = {}) {
    const validate = () => {
        const value = inputEl.value;
        const error = options.customValidator
            ? options.customValidator(value)
            : validateField(value, type);

        if (error) {
            showFieldError(inputEl, error);
            return false;
        } else {
            showFieldSuccess(inputEl);
            return true;
        }
    };

    inputEl.addEventListener('blur', validate);
    inputEl.addEventListener('input', () => {
        // Only show success on input (not error — less aggressive UX)
        if (inputEl.classList.contains('border-red-500')) validate();
    });

    return validate;
}

// Validate entire form — returns errors array
function validateForm(fields) {
    const errors = [];
    let firstError = null;

    for (const { el, type, customValidator, required = true } of fields) {
        if (!el) continue;
        const value = el.value.trim();

        if (!value && !required) continue;

        const error = customValidator
            ? customValidator(value)
            : validateField(value, type);

        if (error) {
            showFieldError(el, error);
            if (!firstError) firstError = el;
            errors.push(error);
        } else {
            showFieldSuccess(el);
        }
    }

    if (firstError) firstError.focus();
    return errors;
}

// ─── DOMPurify Sanitization ───────────────────────────────────────────────────
// Used when rendering any user-supplied or server-returned HTML content

// Strict: strips all HTML tags except safe formatting
function sanitizeStrict(dirty) {
    if (typeof DOMPurify === 'undefined') return escapeHtml(dirty);
    return DOMPurify.sanitize(String(dirty), {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
        ALLOWED_ATTR: []
    });
}

// Text only: strips ALL HTML — for user input that should never contain HTML
function sanitizeText(dirty) {
    if (typeof DOMPurify === 'undefined') return escapeHtml(dirty);
    return DOMPurify.sanitize(String(dirty), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

// For product descriptions that may contain limited formatting
function sanitizeRich(dirty) {
    if (typeof DOMPurify === 'undefined') return escapeHtml(dirty);
    return DOMPurify.sanitize(String(dirty), {
        ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: [],
        FORBID_ATTR:  ['style', 'class', 'id', 'onclick', 'onerror', 'onload']
    });
}

// Fallback HTML escaper when DOMPurify is unavailable
function escapeHtml(str) {
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#039;');
}

// Safe DOM insertion — uses DOMPurify then sets innerHTML
function safeInnerHTML(element, html) {
    element.innerHTML = sanitizeStrict(html);
}

// Check password strength for UI feedback
function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8)  score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password))    score++;
    if (/[@$!%*?&#^()\-_=+]/.test(password)) score++;

    if (score <= 2) return { level: 'Weak',   color: 'bg-red-500',    width: '25%' };
    if (score <= 3) return { level: 'Fair',   color: 'bg-yellow-500', width: '50%' };
    if (score <= 4) return { level: 'Good',   color: 'bg-blue-500',   width: '75%' };
    return            { level: 'Strong', color: 'bg-green-500',  width: '100%' };
}
