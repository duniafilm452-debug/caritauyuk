// ============================================================
// utils.js — Shared utilities (dimuat sebelum semua JS lainnya)
// ============================================================

// ── Session ID ──────────────────────────────────────────────
window.getSessionId = function () {
    let id = localStorage.getItem('session_id');
    if (!id) {
        // FIX: Ganti substr (deprecated) dengan slice
        id = 'session_' + Math.random().toString(36).slice(2, 11);
        localStorage.setItem('session_id', id);
    }
    return id;
};

// ── Truncate Text ───────────────────────────────────────────
window.truncateText = function (text, max) {
    if (!text) return '';
    // FIX: Ganti substr (deprecated) dengan slice
    return text.length <= max ? text : text.slice(0, max) + '…';
};

// ── Format Angka ────────────────────────────────────────────
window.formatNumber = function (num) {
    if (num === null || num === undefined) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'jt';
    if (num >= 1000)    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'rb';
    return String(num);
};

// ── Time Ago (Bahasa Indonesia) ──────────────────────────────
window.formatTimeAgo = function (iso) {
    if (!iso) return '';
    const s = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (s < 60)       return 'Baru saja';
    if (s < 3600)     return Math.floor(s / 60) + ' menit lalu';
    if (s < 86400)    return Math.floor(s / 3600) + ' jam lalu';
    if (s < 2592000)  return Math.floor(s / 86400) + ' hari lalu';
    if (s < 31536000) return Math.floor(s / 2592000) + ' bulan lalu';
    return Math.floor(s / 31536000) + ' tahun lalu';
};

// ── Toast Notifications ──────────────────────────────────────
window.showToast = function (message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success : 'check-circle',
        error   : 'times-circle',
        warning : 'exclamation-circle',
        info    : 'info-circle',
    };

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

    // Tombol tutup
    toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));

    // Auto dismiss setelah 3.5 detik
    setTimeout(() => dismissToast(toast), 3500);
};

function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;   // FIX: guard agar tidak error jika sudah di-remove
    toast.classList.remove('show');
    toast.classList.add('hide');

    // FIX: Fallback timeout agar toast pasti terhapus meskipun
    // animasi CSS tidak terdefinisi (animationend tidak akan terpanggil)
    const fallback = setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 400);

    toast.addEventListener('animationend', () => {
        clearTimeout(fallback);
        if (toast.parentNode) toast.remove();
    }, { once: true });
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
        width: ${size}px;
        height: ${size}px;
        left: ${e.clientX - rect.left - size / 2}px;
        top: ${e.clientY - rect.top - size / 2}px;
    `;

    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
});

// ── Escape HTML (helper keamanan, tersedia global) ──────────
window.escapeHtml = function (str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str || '')));
    return d.innerHTML;
};

// ── Slug Generator ───────────────────────────────────────────
// "10 Kebiasaan Sehat yang Meningkatkan Kualitas Hidup"
//  → "10-kebiasaan-sehat-yang-meningkatkan-kualitas-hidup"
window.createSlug = function (title) {
    if (!title || typeof title !== 'string') return '';
    return title
        .toLowerCase()
        .trim()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ñ]/g, 'n')
        .replace(/[ç]/g, 'c')
        // Hapus semua karakter selain huruf, angka, spasi
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
};

// ── Category → URL Path ──────────────────────────────────────
// Mapping kategori Indonesia → segment URL
// Tambahkan kategori baru di sini jika diperlukan
const _CATEGORY_PATH_MAP = {
    'Film'      : 'film',
    'Teknologi' : 'teknologi',
    'Keuangan'  : 'keuangan',
    'Kesehatan' : 'kesehatan',
    'Lainnya'   : 'lainnya',
};

window.categoryToPath = function (category) {
    return _CATEGORY_PATH_MAP[category]
        || window.createSlug(category)
        || 'artikel';
};

// ── Build Article URL (clean SEO URL) ────────────────────────
// Output: /keuangan/panduan-investasi-saham-untuk-pemula
window.buildArticleUrl = function (content) {
    if (!content) return '#';
    const cat  = window.categoryToPath(content.category || '');
    const slug = content.slug || window.createSlug(content.title || '');
    if (!slug) return '#';
    return '/' + cat + '/' + slug;
};