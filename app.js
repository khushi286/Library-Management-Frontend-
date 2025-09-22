// Replace with your actual backend API base URL
const API_BASE_URL = 'https://api.yourdomain.com';

document.addEventListener('DOMContentLoaded', () => {
    // --- Common Elements ---
    const loader = document.getElementById('loader');
    const toast = document.getElementById('toast');
    const modal = document.getElementById('modal');

    // --- Utility Functions ---
    const showLoader = () => loader.classList.remove('hidden');
    const hideLoader = () => loader.classList.add('hidden');

    const showToast = (message, type = 'success') => {
        toast.textContent = message;
        toast.className = 'toast show';
        toast.classList.add(type); // 'success' or 'error'
        setTimeout(() => toast.classList.remove('show'), 3000);
    };
    
    const showModal = (title, message) => {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
        modal.classList.remove('hidden');
        document.getElementById('modal-close-btn').onclick = () => modal.classList.add('hidden');
    };

    const showError = (input, message) => {
        const formGroup = input.parentElement;
        const errorElement = formGroup.querySelector('.error-message');
        errorElement.textContent = message;
    };

    const clearErrors = (form) => {
        form.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    };

    const apiPost = async (path, body) => {
        showLoader();
        const submitBtn = document.querySelector('button[type="submit"]:not(:disabled)');
        if (submitBtn) submitBtn.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok) {
                // Throw an error object that includes status and error message
                throw { status: response.status, message: data.error || 'An unknown error occurred.' };
            }
            return data;
        } finally {
            hideLoader();
            if (submitBtn) submitBtn.disabled = false;
        }
    };
    
    // --- JWT Management ---
    const saveToken = (token) => localStorage.setItem('jwt_token', token);
    const getToken = () => localStorage.getItem('jwt_token');
    const clearToken = () => localStorage.removeItem('jwt_token');

    // --- Page Initializers ---

    // 1. SIGNUP PAGE
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateSignupForm()) return;

            const formData = new FormData(signupForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const result = await apiPost('/signup', {
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    password: data.password
                });
                
                sessionStorage.setItem('userIdForOtp', result.userId);
                showToast(result.message, 'success');
                setTimeout(() => window.location.href = 'otp.html', 1500);

            } catch (error) {
                if (error.status === 400 || error.status === 422) {
                    showError(document.getElementById('email'), error.message);
                } else {
                    showToast(error.message || 'Signup failed. Please try again.', 'error');
                }
            }
        });
    }

    // 2. LOGIN PAGE
    const passwordLoginForm = document.getElementById('password-login-form');
    const otpLoginForm = document.getElementById('otp-login-form');
    if (passwordLoginForm) {
        // Tab switching logic
        const tabs = document.querySelectorAll('.tab-link');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelector('.tab-link.active').classList.remove('active');
                document.querySelector('.tab-content.active').classList.remove('active');
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');
            });
        });

        // Password Login
        passwordLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors(passwordLoginForm);
            const emailOrPhone = document.getElementById('emailOrPhonePass');
            const password = document.getElementById('password');
            let isValid = true;
            if (!emailOrPhone.value) {
                showError(emailOrPhone, 'Email or phone is required.');
                isValid = false;
            }
            if (!password.value) {
                showError(password, 'Password is required.');
                isValid = false;
            }
            if (!isValid) return;

            try {
                const result = await apiPost('/login', {
                    emailOrPhone: emailOrPhone.value,
                    password: password.value
                });
                saveToken(result.token);
                // Assuming homepage is 'index.html'
                window.location.href = 'index.html'; 
            } catch (error) {
                if (error.status === 401) {
                    showError(password, error.message);
                } else if (error.status === 403) {
                    showModal('Account Pending', error.message);
                } else {
                    showToast(error.message || 'Login failed.', 'error');
                }
            }
        });

        // OTP Login - Step 1: Send OTP
        otpLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors(otpLoginForm);
            const emailOrPhone = document.getElementById('emailOrPhoneOtp');
            if (!emailOrPhone.value) {
                showError(emailOrPhone, 'Email or phone is required.');
                return;
            }

            try {
                await apiPost('/login-otp', { identifier: emailOrPhone.value });
                sessionStorage.setItem('identifierForOtpLogin', emailOrPhone.value);
                showToast('OTP sent successfully!', 'success');
                 setTimeout(() => window.location.href = 'otp.html', 1500);
            } catch (error) {
                showToast(error.message || 'Failed to send OTP.', 'error');
            }
        });
    }

    // 3. OTP VERIFICATION PAGE
    const otpForm = document.getElementById('otp-form');
    if (otpForm) {
        const userId = sessionStorage.getItem('userIdForOtp');
        const identifier = sessionStorage.getItem('identifierForOtpLogin');

        if (!userId && !identifier) {
            // No context for OTP, redirect to login
            window.location.href = 'login.html';
            return;
        }

        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors(otpForm);
            const otpInput = document.getElementById('otp');
            if (!/^\d{6}$/.test(otpInput.value)) {
                showError(otpInput, 'OTP must be 6 digits.');
                return;
            }

            try {
                let result;
                if (userId) { // Signup flow
                    result = await apiPost('/verify-otp', { userId, otp: otpInput.value });
                } else { // Login flow
                    result = await apiPost('/verify-otp-login', { identifier, otp: otpInput.value });
                }
                
                saveToken(result.token);
                sessionStorage.removeItem('userIdForOtp');
                sessionStorage.removeItem('identifierForOtpLogin');

                if (result.user.status === 'approved') {
                    showToast('Verification successful! Redirecting...', 'success');
                    setTimeout(() => window.location.href = 'index.html', 1500); // Redirect to homepage
                } else { // Pending status
                    otpForm.classList.add('hidden');
                    document.getElementById('otp-title').textContent = 'Account Created!';
                    document.getElementById('otp-subtitle').classList.add('hidden');
                    const finalMessage = document.getElementById('final-message');
                    finalMessage.textContent = 'Your account has been created and is waiting for admin approval.';
                    finalMessage.classList.remove('hidden');
                }

            } catch (error) {
                showToast(error.message || 'OTP verification failed.', 'error');
            }
        });
    }
});

// --- Validation Logic ---
const validateSignupForm = () => {
    const form = document.getElementById('signup-form');
    clearErrors(form);
    let isValid = true;
    let firstInvalidField = null;

    const name = form.elements['name'];
    const email = form.elements['email'];
    const phone = form.elements['phone'];
    const password = form.elements['password'];
    const confirmPassword = form.elements['confirmPassword'];

    // Name validation
    if (name.value.trim().length < 2) {
        showError(name, 'Full name must be at least 2 characters.');
        isValid = false;
        if (!firstInvalidField) firstInvalidField = name;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.value)) {
        showError(email, 'Please enter a valid email address.');
        isValid = false;
        if (!firstInvalidField) firstInvalidField = email;
    }

    // Phone validation
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone.value)) {
        showError(phone, 'Phone number must be 10 digits.');
        isValid = false;
        if (!firstInvalidField) firstInvalidField = phone;
    }

    // Password validation
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    if (!passwordRegex.test(password.value)) {
        showError(password, 'Password must be at least 8 characters, with 1 letter and 1 number.');
        isValid = false;
        if (!firstInvalidField) firstInvalidField = password;
    }

    // Confirm password validation
    if (password.value !== confirmPassword.value) {
        showError(confirmPassword, 'Passwords do not match.');
        isValid = false;
        if (!firstInvalidField) firstInvalidField = confirmPassword;
    }
    
    if (firstInvalidField) {
        firstInvalidField.focus();
    }

    return isValid;
};