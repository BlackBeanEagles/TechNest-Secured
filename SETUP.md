# TechNest — Secure E-Commerce Setup Guide

## Prerequisites
- Node.js 18+
- MySQL 8.0+
- A terminal

---

## Step 1 — Database Setup

Open MySQL and run:

```sql
-- Run schema first
source C:/Users/hridy/secure-shop/database/schema.sql

-- Then seed sample data
source C:/Users/hridy/secure-shop/database/seed.sql
```

Or via CLI:
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

---

## Step 2 — Backend Setup

```bash
cd backend
npm install
```

Edit `.env` and set your MySQL password:
```
DB_PASSWORD=your_actual_mysql_password
```

---

## Step 3 — Start the Server

```bash
cd backend
npm run dev        # development (auto-restart)
# or
npm start          # production
```

Server starts at: **http://localhost:5000**

---

## Demo Credentials

| Role  | Username | Password    |
|-------|----------|-------------|
| Admin | admin    | Admin@1234  |
| User  | johndoe  | User@1234   |

> Note: The seed.sql uses bcrypt hashes. If login fails, re-hash manually:
> ```js
> const bcrypt = require('bcryptjs');
> bcrypt.hash('Admin@1234', 12).then(console.log);
> ```
> Then UPDATE the users table with the new hash.

---

## Pages

| URL              | Description          | Access |
|------------------|----------------------|--------|
| /                | Product listing      | Public |
| /login.html      | Login                | Public |
| /register.html   | Registration         | Public |
| /cart.html       | Shopping cart        | User   |
| /orders.html     | Order history        | User   |
| /admin.html      | Admin dashboard      | Admin  |

---

## Security Features Demonstrated

### Authentication & Authorization
- JWT access tokens in **httpOnly cookies** (XSS-safe)
- Refresh tokens stored as SHA-256 hashes in DB
- **Role-based access control** (admin / user) via middleware
- Account lockout after 5 failed login attempts (15-min cooldown)
- Timing-safe login (prevents user enumeration)

### Input Validation & Attack Prevention
- **No ORM** — all queries use MySQL2 prepared statements (`?` placeholders)
- `multipleStatements: false` on DB pool (blocks stacked queries)
- ORDER BY uses **whitelisted column names** (prevents injection via sort param)
- Backend regex validation on all inputs (username, email, password, price, etc.)
- Frontend: **DOMPurify** sanitizes HTML before DOM insertion
- Frontend: **Regex patterns** validate all form fields live
- Rate limiting: 10 auth attempts per 15 min, 5 registrations per hour
- Request body size limited to 10kb (prevents DoS)

### Data Protection
- Passwords hashed with **bcrypt** (cost factor 12)
- Refresh tokens stored as **SHA-256 hashes** (never raw)
- **Helmet.js** sets security headers (CSP, X-Frame-Options, etc.)
- CSRF protection via **double-submit cookie** pattern
- **IDOR prevention** — all user-scoped queries include `AND user_id = ?`
- Soft deletes preserve order history integrity
- Audit log records all sensitive actions with IP address

### Frontend Security
- `textContent` used for all dynamic data (never raw `innerHTML`)
- `DOMPurify.sanitize()` used before any HTML insertion
- CSRF token read from cookie, sent as `X-CSRF-Token` header
- Input character stripping on search fields (`<>'";&`)
- Password strength meter with visual feedback
- Image URLs validated against `https?://` pattern before use
