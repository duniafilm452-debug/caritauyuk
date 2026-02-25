// ============================================================
// utils.js — Shared utilities (dimuat sebelum semua JS lainnya)
// ============================================================

// ── Session ID ──────────────────────────────────────────────
window.getSessionId = function () {
    let id = localStorage.getItem('session_id');
    if (!id) {
        id = 'session_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('session_id', id);
    }
    return id;
};

// ── Truncate Text ───────────────────────────────────────────
window.truncateText = function (text, max) {
    if (!text) return '';
    return text.length <= max ? text : text.substr(0, max) + '…';
};

// ── Toast Notifications ──────────────────────────────────────
window.showToast = function (message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-circle', info: 'info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${icons[type] || icons.info} toast-icon"></i>
        <span class="toast-msg">${message}</span>
        <button class="toast-close" aria-label="Tutup">&times;</button>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('show'));

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));

    // Auto dismiss
    setTimeout(() => dismissToast(toast), 3500);
};

function dismissToast(toast) {
    toast.classList.remove('show');
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

// ── Button Ripple Effect ─────────────────────────────────────
document.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn, .category-btn, .like-btn, .table-btn, .error-btn');
    if (!btn) return;

    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `
        width: ${size}px; height: ${size}px;
        left: ${e.clientX - rect.left - size / 2}px;
        top: ${e.clientY - rect.top - size / 2}px;
    `;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
});
