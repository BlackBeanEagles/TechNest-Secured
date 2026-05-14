// Server-side validation utility
// All validation uses strict regex patterns — no ORM, no magic

const PATTERNS = {
    username:    /^[a-zA-Z0-9_]{3,50}$/,
    email:       /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
    password:    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+[\]{};:'",.<>\/\\|`~])[A-Za-z\d@$!%*?&#^()\-_=+[\]{};:'",.<>\/\\|`~]{8,128}$/,
    name:        /^[a-zA-Z\s'\-]{1,50}$/,
    phone:       /^\+?[\d\s\-()\[\]]{7,20}$/,
    price:       /^\d{1,8}(\.\d{1,2})?$/,
    quantity:    /^[1-9]\d{0,3}$/,          // 1-9999
    category:    /^[a-zA-Z\s&\-]{2,50}$/,
    positiveInt: /^[1-9]\d*$/,
    orderStatus: /^(pending|processing|shipped|delivered|cancelled)$/
};

function validateField(value, pattern, fieldName) {
    if (value === undefined || value === null || value === '') {
        return `${fieldName} is required`;
    }
    const str = String(value).trim();
    if (!PATTERNS[pattern].test(str)) {
        return `${fieldName} is invalid`;
    }
    return null;
}

function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.trim()
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
        .substring(0, 1000); // max length guard
}

function validateRegistration(body) {
    const errors = [];
    const { username, email, password, first_name, last_name, phone } = body;

    const usernameErr = validateField(username, 'username', 'Username');
    if (usernameErr) errors.push(usernameErr);

    const emailErr = validateField(email, 'email', 'Email');
    if (emailErr) errors.push(emailErr);

    const passErr = validateField(password, 'password', 'Password');
    if (passErr) errors.push(passErr);

    if (first_name && !PATTERNS.name.test(first_name.trim())) {
        errors.push('First name is invalid');
    }
    if (last_name && !PATTERNS.name.test(last_name.trim())) {
        errors.push('Last name is invalid');
    }
    if (phone && !PATTERNS.phone.test(phone.trim())) {
        errors.push('Phone number is invalid');
    }

    return errors;
}

function validateLogin(body) {
    const errors = [];
    const { identifier, password } = body;

    if (!identifier || String(identifier).trim().length < 3) {
        errors.push('Username or email is required');
    }
    if (!password || String(password).length < 1) {
        errors.push('Password is required');
    }
    // Limit length to prevent DoS
    if (String(identifier || '').length > 100) errors.push('Identifier too long');
    if (String(password || '').length > 256) errors.push('Password too long');

    return errors;
}

function validateProduct(body) {
    const errors = [];
    const { name, description, price, category, stock } = body;

    if (!name || String(name).trim().length < 2 || String(name).trim().length > 100) {
        errors.push('Product name must be 2-100 characters');
    }
    if (description && String(description).length > 2000) {
        errors.push('Description too long (max 2000 characters)');
    }

    const priceErr = validateField(price, 'price', 'Price');
    if (priceErr) errors.push(priceErr);
    else if (parseFloat(price) <= 0 || parseFloat(price) > 99999999) {
        errors.push('Price must be between 0.01 and 99999999');
    }

    const catErr = validateField(category, 'category', 'Category');
    if (catErr) errors.push(catErr);

    if (stock !== undefined && stock !== null) {
        const stockNum = parseInt(stock);
        if (isNaN(stockNum) || stockNum < 0 || stockNum > 99999) {
            errors.push('Stock must be between 0 and 99999');
        }
    }

    return errors;
}

function validateCartItem(body) {
    const errors = [];
    const { product_id, quantity } = body;

    if (!product_id || !PATTERNS.positiveInt.test(String(product_id))) {
        errors.push('Valid product ID is required');
    }
    if (!quantity || !PATTERNS.quantity.test(String(quantity))) {
        errors.push('Quantity must be between 1 and 9999');
    }

    return errors;
}

function validateOrder(body) {
    const errors = [];
    const { shipping_address } = body;

    if (!shipping_address || String(shipping_address).trim().length < 10) {
        errors.push('Shipping address is required (min 10 characters)');
    }
    if (String(shipping_address || '').length > 500) {
        errors.push('Shipping address too long');
    }

    return errors;
}

module.exports = {
    PATTERNS,
    sanitizeString,
    validateRegistration,
    validateLogin,
    validateProduct,
    validateCartItem,
    validateOrder,
    validateField
};
