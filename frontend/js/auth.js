// Auth page logic — login.html + register.html

document.addEventListener('DOMContentLoaded', () => {
    const loginForm    = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    // ─── Login ──────────────────────────────────────────────────────────────
    if (loginForm) {
        const identifierEl = document.getElementById('identifier');
        const passwordEl   = document.getElementById('password');
        const submitBtn    = document.getElementById('loginBtn');
        const errorBox     = document.getElementById('loginError');

        // Live validation
        attachLiveValidation(identifierEl, null, {
            customValidator: (v) => v.length < 3 ? 'Username or email is required' : null
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const errors = validateForm([
                { el: identifierEl, customValidator: (v) => v.length < 3 ? 'Enter your username or email' : null },
                { el: passwordEl,   customValidator: (v) => v.length < 1  ? 'Enter your password' : null }
            ]);

            if (errors.length) return;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';
            errorBox.classList.add('hidden');

            try {
                const res = await apiFetch('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({
                        identifier: sanitizeText(identifierEl.value.trim()),
                        password:   passwordEl.value       // Raw — server hashes it
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    // Show error via textContent — never innerHTML with user data
                    errorBox.textContent = data.error || 'Login failed';
                    errorBox.classList.remove('hidden');
                    return;
                }

                setCurrentUser(data.user);
                showToast('Welcome back, ' + sanitizeText(data.user.username) + '!');

                const redirect = sessionStorage.getItem('redirect_after_login');
                sessionStorage.removeItem('redirect_after_login');

                setTimeout(() => {
                    window.location.href = data.user.role === 'admin'
                        ? '/admin.html'
                        : (redirect || '/index.html');
                }, 500);

            } catch {
                errorBox.textContent = 'Network error. Please try again.';
                errorBox.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
            }
        });
    }

    // ─── Register ────────────────────────────────────────────────────────────
    if (registerForm) {
        const fields = {
            username:   document.getElementById('username'),
            email:      document.getElementById('email'),
            password:   document.getElementById('password'),
            confirm:    document.getElementById('confirmPassword'),
            first_name: document.getElementById('first_name'),
            last_name:  document.getElementById('last_name'),
            phone:      document.getElementById('phone')
        };
        const submitBtn    = document.getElementById('registerBtn');
        const errorBox     = document.getElementById('registerError');
        const successBox   = document.getElementById('registerSuccess');
        const strengthBar  = document.getElementById('strengthBar');
        const strengthText = document.getElementById('strengthText');

        // Live validations
        attachLiveValidation(fields.username, 'username');
        attachLiveValidation(fields.email, 'email');
        attachLiveValidation(fields.first_name, 'name', { customValidator: (v) => v && !VALIDATORS.name.regex.test(v) ? VALIDATORS.name.message : null });
        attachLiveValidation(fields.last_name,  'name', { customValidator: (v) => v && !VALIDATORS.name.regex.test(v) ? VALIDATORS.name.message : null });
        attachLiveValidation(fields.phone, 'phone', { customValidator: (v) => v && !VALIDATORS.phone.regex.test(v) ? VALIDATORS.phone.message : null });

        // Password strength meter
        if (fields.password && strengthBar) {
            fields.password.addEventListener('input', () => {
                const strength = getPasswordStrength(fields.password.value);
                strengthBar.className = `h-full rounded-full transition-all duration-300 ${strength.color}`;
                strengthBar.style.width = strength.width;
                strengthText.textContent = strength.level;
                strengthText.className = `text-xs font-medium ${
                    strength.level === 'Strong' ? 'text-green-400' :
                    strength.level === 'Good'   ? 'text-blue-400'  :
                    strength.level === 'Fair'   ? 'text-yellow-400': 'text-red-400'
                }`;
            });
        }

        // Confirm password validation
        attachLiveValidation(fields.confirm, null, {
            customValidator: (v) => v !== fields.password.value ? 'Passwords do not match' : null
        });

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const errors = validateForm([
                { el: fields.username,   type: 'username' },
                { el: fields.email,      type: 'email' },
                { el: fields.password,   type: 'password' },
                { el: fields.confirm,    customValidator: (v) => v !== fields.password.value ? 'Passwords do not match' : null },
                { el: fields.first_name, customValidator: (v) => v && !VALIDATORS.name.regex.test(v) ? VALIDATORS.name.message : null, required: false },
                { el: fields.last_name,  customValidator: (v) => v && !VALIDATORS.name.regex.test(v) ? VALIDATORS.name.message : null, required: false },
                { el: fields.phone,      customValidator: (v) => v && !VALIDATORS.phone.regex.test(v) ? VALIDATORS.phone.message : null, required: false }
            ]);

            if (errors.length) return;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';
            errorBox.classList.add('hidden');
            successBox.classList.add('hidden');

            try {
                const payload = {
                    username:   sanitizeText(fields.username.value.trim()),
                    email:      sanitizeText(fields.email.value.trim()),
                    password:   fields.password.value,
                    first_name: fields.first_name?.value ? sanitizeText(fields.first_name.value.trim()) : undefined,
                    last_name:  fields.last_name?.value  ? sanitizeText(fields.last_name.value.trim())  : undefined,
                    phone:      fields.phone?.value      ? sanitizeText(fields.phone.value.trim())      : undefined
                };

                const res = await apiFetch('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (!res.ok) {
                    const msg = Array.isArray(data.errors) ? data.errors.join(', ') : (data.error || 'Registration failed');
                    errorBox.textContent = sanitizeText(msg);
                    errorBox.classList.remove('hidden');
                    return;
                }

                successBox.textContent = 'Account created! Redirecting to login...';
                successBox.classList.remove('hidden');
                registerForm.reset();

                setTimeout(() => window.location.href = '/login.html', 2000);

            } catch {
                errorBox.textContent = 'Network error. Please try again.';
                errorBox.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
            }
        });
    }
});
