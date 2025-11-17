/**
 * Form Handler Utilities
 * Reusable functions for form validation, submission, and error handling
 */

// Show error message
function showError(element, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger mt-2';
    errorDiv.textContent = message;
    
    // Remove existing errors
    const existingError = element.parentElement.querySelector('.alert-danger');
    if (existingError) {
        existingError.remove();
    }
    
    element.parentElement.appendChild(errorDiv);
    element.classList.add('is-invalid');
}

// Clear error message
function clearError(element) {
    const errorDiv = element.parentElement.querySelector('.alert-danger');
    if (errorDiv) {
        errorDiv.remove();
    }
    element.classList.remove('is-invalid');
}

// Show success message
function showSuccess(container, message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.textContent = message;
    
    // Remove existing messages
    const existingAlert = container.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    container.insertBefore(successDiv, container.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        successDiv.remove();
    }, 5000);
}

// Show form error (general)
function showFormError(form, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger';
    errorDiv.textContent = message;
    
    // Remove existing errors
    const existingError = form.querySelector('.alert-danger');
    if (existingError) {
        existingError.remove();
    }
    
    form.insertBefore(errorDiv, form.firstChild);
}

// Clear all form errors
function clearFormErrors(form) {
    const errors = form.querySelectorAll('.alert-danger');
    errors.forEach(error => error.remove());
    
    const invalidInputs = form.querySelectorAll('.is-invalid');
    invalidInputs.forEach(input => input.classList.remove('is-invalid'));
}

// Handle Laravel validation errors
function handleValidationErrors(errors, form) {
    clearFormErrors(form);
    
    Object.keys(errors).forEach(field => {
        const input = form.querySelector(`[name="${field}"]`);
        if (input) {
            showError(input, errors[field][0]);
        }
    });
}

// Disable form during submission
function disableForm(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';
    }
    
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => input.disabled = true);
}

// Enable form after submission
function enableForm(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || 'Submit';
    }
    
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => input.disabled = false);
}

// Generic form submission handler
async function handleFormSubmit(form, apiCallback, successCallback, errorCallback) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    clearFormErrors(form);
    disableForm(form);
    
    try {
        const response = await apiCallback(data);
        
        if (successCallback) {
            successCallback(response);
        }
        
        return response;
    } catch (error) {
        if (error.errors) {
            // Laravel validation errors
            handleValidationErrors(error.errors, form);
        } else {
            showFormError(form, error.message || 'An error occurred');
        }
        
        if (errorCallback) {
            errorCallback(error);
        }
        
        throw error;
    } finally {
        enableForm(form);
    }
}

// Setup form with API integration
function setupForm(formSelector, apiCallback, options = {}) {
    const form = document.querySelector(formSelector);
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const response = await handleFormSubmit(
                form, 
                apiCallback,
                options.onSuccess,
                options.onError
            );
            
            // Default success handling
            if (!options.onSuccess && options.successMessage) {
                showSuccess(form, options.successMessage);
            }
            
            // Default redirect
            if (options.redirectTo) {
                setTimeout(() => {
                    window.location.href = options.redirectTo;
                }, options.redirectDelay || 1500);
            }
        } catch (error) {
            console.error('Form submission error:', error);
        }
    });
    
    // Clear errors on input change
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', () => clearError(input));
    });
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate phone number (Nigerian format)
function isValidPhone(phone) {
    const phoneRegex = /^(\+234|0)[789][01]\d{8}$/;
    return phoneRegex.test(phone);
}

// Validate password strength
function validatePassword(password) {
    const errors = [];
    
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

// Format currency (Naira)
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0
    }).format(amount);
}

// Format date
function formatDate(dateString, options = {}) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options
    }).format(date);
}

// Format date with time
function formatDateTime(dateString) {
    return formatDate(dateString, {
        hour: 'numeric',
        minute: 'numeric'
    });
}

// Get relative time (e.g., "2 hours ago")
function getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, seconds] of Object.entries(intervals)) {
        const interval = Math.floor(diffInSeconds / seconds);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }
    
    return 'Just now';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show loading spinner
function showLoading(container) {
    const spinner = document.createElement('div');
    spinner.className = 'text-center py-5 loading-spinner';
    spinner.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
    container.appendChild(spinner);
}

// Hide loading spinner
function hideLoading(container) {
    const spinner = container.querySelector('.loading-spinner');
    if (spinner) {
        spinner.remove();
    }
}

// Confirm action with modal
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Copy failed:', error);
        return false;
    }
}

// Download file
function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showError,
        clearError,
        showSuccess,
        showFormError,
        clearFormErrors,
        handleValidationErrors,
        disableForm,
        enableForm,
        handleFormSubmit,
        setupForm,
        isValidEmail,
        isValidPhone,
        validatePassword,
        formatCurrency,
        formatDate,
        formatDateTime,
        getRelativeTime,
        escapeHtml,
        showLoading,
        hideLoading,
        confirmAction,
        copyToClipboard,
        downloadFile,
        debounce,
    };
}

// Make available globally
window.showError = showError;
window.clearError = clearError;
window.showSuccess = showSuccess;
window.showFormError = showFormError;
window.clearFormErrors = clearFormErrors;
window.handleValidationErrors = handleValidationErrors;
window.disableForm = disableForm;
window.enableForm = enableForm;
window.handleFormSubmit = handleFormSubmit;
window.setupForm = setupForm;
window.isValidEmail = isValidEmail;
window.isValidPhone = isValidPhone;
window.validatePassword = validatePassword;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.getRelativeTime = getRelativeTime;
window.escapeHtml = escapeHtml;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.confirmAction = confirmAction;
window.copyToClipboard = copyToClipboard;
window.downloadFile = downloadFile;
window.debounce = debounce;
