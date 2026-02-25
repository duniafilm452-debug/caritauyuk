// ============================================================
// detail.js — Logika halaman detail konten
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.contentDB === 'undefined') {
        console.error('contentDB tidak ditemukan. Pastikan db.js dimuat dengan benar.');
        return;
    }
    await initializeDetail();
});

// ── URL Params ────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const contentId = urlParams.get('id');

// ── DOM Elements ──────────────────────────────────────────────
const detailMain    = document.querySelector('.detail-main');
const detailSidebar = document.querySelector('.detail-sidebar');
const loadingSpinner = document.getElementById('loadingSpinner');

// ── Init ──────────────────────────────────────────────────────
async function initializeDetail() {
    if (!contentId) {
        window.location.href = '404.html';
        return;
    }
    await loadContentDetail();
    setupEventListeners();
}

function setupEventListeners() {
    const backBtn = document.querySelector('.back-button');
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.back();
        });
    }
    setupShareButtons();
}

// ── Load Detail ───────────────────────────────────────────────
async function loadContentDetail() {
    showLoading(true);

    const { data: content, error } = await window.contentDB.getContentById(contentId);
    if (error || !content) {
        showLoading(false);
        window.location.href = '404.html';
        return;
    }

    const sessionId = window.getSessionId();
    const { liked } = await window.contentDB.checkLikeStatus(contentId, sessionId);
    const { data: related } = await window.contentDB.getRelatedContent(content.category, contentId, 5);

    renderMainContent(content, liked);
    renderSidebar(related || []);
    renderComments(content);

    showLoading(false);
}

// ── Render Main ───────────────────────────────────────────────
function renderMainContent(content, liked) {
    if (!detailMain) return;

    detailMain.innerHTML = `
        <div class="media-player">
            ${renderMedia(content)}
        </div>
        <div class="content-info">
            <h1 class="content-title">${content.title}</h1>
            <div class="content-meta">
                <span class="meta-item"><i class="fas fa-film"></i> ${content.category}</span>
                <span class="meta-item"><i class="far fa-calendar"></i> ${content.year || 'N/A'}</span>
                <span class="meta-item"><i class="far fa-clock"></i> ${content.duration || 'N/A'}</span>
                <span class="meta-item"><i class="fas fa-star" style="color:#F5A623"></i> ${content.rating || 'N/A'}</span>
            </div>
            <div class="content-description">${content.description || 'Tidak ada deskripsi.'}</div>
            <div class="content-tags">
                ${(content.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}
            </div>
            <div class="content-actions">
                <button class="btn btn-like ${liked ? 'liked' : ''}"
                        onclick="handleLike('${content.id}', this)">
                    <i class="${liked ? 'fas' : 'far'} fa-heart"></i>
                    <span class="like-count">${content.likes || 0}</span>
                    Suka
                </button>
                <button class="btn btn-outline" onclick="shareContent()">
                    <i class="fas fa-share-alt"></i> Bagikan
                </button>
            </div>
            ${renderAffiliateBlock(content)}
        </div>`;

    addShareButtons();
}

function renderMedia(content) {
    if (content.youtube_id) {
        return `
            <iframe src="https://www.youtube.com/embed/${content.youtube_id}"
                title="${content.title}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>`;
    }
    if (content.video_url) {
        return `
            <video controls>
                <source src="${content.video_url}" type="video/mp4">
                Browser Anda tidak mendukung tag video.
            </video>`;
    }
    if (content.thumbnail_url) {
        return `<img src="${content.thumbnail_url}" alt="${content.title}">`;
    }
    return `
        <div class="media-placeholder">
            <i class="fas fa-play-circle"></i>
            <h3>${content.title}</h3>
            <p>Klik tombol play untuk menonton</p>
        </div>`;
}

function renderAffiliateBlock(content) {
    if (!content.affiliate_url || !content.affiliate_label) return '';
    return `
        <div class="affiliate-block">
            ${content.affiliate_badge ? `<span class="affiliate-badge">${content.affiliate_badge}</span>` : ''}
            <h3 class="affiliate-title">${content.affiliate_label}</h3>
            ${content.affiliate_desc ? `<p class="affiliate-desc">${content.affiliate_desc}</p>` : ''}
            <a href="${content.affiliate_url}"
               class="affiliate-link"
               target="_blank"
               rel="nofollow sponsored">
                ${content.affiliate_label} <i class="fas fa-arrow-right"></i>
            </a>
        </div>`;
}

// ── Render Sidebar ────────────────────────────────────────────
function renderSidebar(relatedContent) {
    if (!detailSidebar) return;

    const adHtml = `
        <div class="ad-slot sidebar-widget">
            <span>Iklan 300x250</span>
        </div>`;

    let relatedHtml = '';
    if (relatedContent.length > 0) {
        relatedHtml = `
            <div class="sidebar-widget">
                <h4 class="sidebar-title">Konten Terkait</h4>
                <ul class="related-list">
                    ${relatedContent.map(item => `
                        <li class="related-item">
                            <img src="${item.thumbnail_url || DEFAULT_THUMBNAIL}"
                                 alt="${item.title}"
                                 class="related-thumbnail"
                                 onerror="this.src='${DEFAULT_THUMBNAIL}'">
                            <div class="related-info">
                                <a href="detail.html?id=${item.id}" class="related-title">${item.title}</a>
                                <div class="related-meta">
                                    <span><i class="fas fa-heart"></i> ${item.likes || 0}</span>
                                    <span><i class="far fa-clock"></i> ${item.duration || 'N/A'}</span>
                                </div>
                            </div>
                        </li>`).join('')}
                </ul>
            </div>`;
    }

    detailSidebar.innerHTML = adHtml + relatedHtml + adHtml;
}

// ── Render Comments ───────────────────────────────────────────
function renderComments(content) {
    const section = document.querySelector('.comments-section');
    if (!section) return;

    section.innerHTML = `
        <h4 class="sidebar-title">Komentar (0)</h4>
        <div class="comment-form">
            <textarea class="comment-input" placeholder="Tulis komentar Anda..." rows="3"></textarea>
            <button class="btn btn-primary" onclick="postComment()">
                <i class="fas fa-paper-plane"></i> Kirim Komentar
            </button>
        </div>
        <ul class="comment-list">
            <li class="comment-item">
                <div class="comment-avatar">A</div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">Admin</span>
                        <span class="comment-date">2 jam lalu</span>
                    </div>
                    <div class="comment-text">
                        Terima kasih telah mengunjungi halaman ini. Silakan tinggalkan komentar Anda!
                    </div>
                </div>
            </li>
        </ul>`;
}

// ── Like Handler ──────────────────────────────────────────────
async function handleLike(contentId, buttonEl) {
    try {
        const sessionId = window.getSessionId();
        const { liked, error } = await window.contentDB.likeContent(contentId, sessionId);

        if (error) { window.showToast('Gagal memproses like', 'error'); return; }

        const icon  = buttonEl.querySelector('i');
        const count = buttonEl.querySelector('.like-count');
        const cur   = parseInt(count.textContent);

        if (liked) {
            buttonEl.classList.add('liked');
            icon.className = 'fas fa-heart';
            count.textContent = cur + 1;
            window.showToast('Konten disukai! ❤️', 'success');
        } else {
            buttonEl.classList.remove('liked');
            icon.className = 'far fa-heart';
            count.textContent = cur - 1;
            window.showToast('Like dibatalkan', 'info');
        }
    } catch (err) {
        console.error('Error handling like:', err);
        window.showToast('Terjadi kesalahan', 'error');
    }
}

// ── Share ─────────────────────────────────────────────────────
function addShareButtons() {
    const container = document.createElement('div');
    container.className = 'share-buttons';
    container.innerHTML = `
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}"
           target="_blank" class="share-btn share-facebook" title="Bagikan ke Facebook">
            <i class="fab fa-facebook-f"></i>
        </a>
        <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(document.title)}"
           target="_blank" class="share-btn share-twitter" title="Bagikan ke Twitter">
            <i class="fab fa-twitter"></i>
        </a>
        <a href="https://wa.me/?text=${encodeURIComponent(document.title + ' ' + window.location.href)}"
           target="_blank" class="share-btn share-whatsapp" title="Bagikan ke WhatsApp">
            <i class="fab fa-whatsapp"></i>
        </a>
        <a href="https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(document.title)}"
           target="_blank" class="share-btn share-telegram" title="Bagikan ke Telegram">
            <i class="fab fa-telegram-plane"></i>
        </a>`;

    const actions = document.querySelector('.content-actions');
    if (actions) actions.after(container);
}

function setupShareButtons() {
    // FIX: Dideklarasikan sebagai function biasa, bukan hanya window property
    // sehingga tidak terjadi ReferenceError saat dipanggil via window.shareContent = shareContent
}

// FIX: shareContent dideklarasikan sebagai function expression yang di-assign ke window
// (tidak ada referensi lokal yang belum ada)
window.shareContent = async function () {
    if (navigator.share) {
        try {
            await navigator.share({
                title: document.title,
                text: document.querySelector('.content-description')?.textContent || '',
                url: window.location.href,
            });
            window.showToast('Terima kasih telah berbagi!', 'success');
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Error sharing:', err);
        }
    } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
            window.showToast('Link disalin ke clipboard!', 'success');
        }).catch(() => {
            window.showToast('Gagal menyalin link', 'error');
        });
    }
};

function postComment() {
    window.showToast('Fitur komentar akan segera hadir!', 'info');
}

function showLoading(show) {
    if (loadingSpinner) loadingSpinner.classList.toggle('hidden', !show);
}

// Expose globally
window.handleLike   = handleLike;
window.postComment  = postComment;
