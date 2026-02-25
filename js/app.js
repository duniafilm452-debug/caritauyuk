// ============================================================
// app.js — Logika halaman utama (index.html)
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.contentDB === 'undefined') {
        console.error('contentDB tidak ditemukan. Pastikan db.js dimuat dengan benar.');
        return;
    }
    await initializeApp();
});

// ── State ─────────────────────────────────────────────────────
let currentCategory = 'Semua';
let currentSearchQuery = '';
let filteredContent = [];

// ── DOM Elements ──────────────────────────────────────────────
const contentGrid    = document.getElementById('contentGrid');
const categoryBtns   = document.querySelectorAll('.category-btn');
const searchInput    = document.getElementById('searchInput');
const loadingSpinner = document.getElementById('loadingSpinner');

// ── Init ──────────────────────────────────────────────────────
async function initializeApp() {
    // FIX: Baca URL params (?category=Film & ?search=kata) saat halaman dibuka
    const params = new URLSearchParams(window.location.search);
    const paramCat    = params.get('category');
    const paramSearch = params.get('search');

    if (paramCat && ['Film','Teknologi','Keuangan','Kesehatan','Semua'].includes(paramCat)) {
        currentCategory = paramCat;
    }
    if (paramSearch) {
        currentSearchQuery = paramSearch;
    }

    // Sinkronkan UI tombol kategori
    categoryBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === currentCategory);
    });

    // Sinkronkan input pencarian
    if (searchInput && paramSearch) {
        searchInput.value = paramSearch;
    }

    setupEventListeners();
    await filterAndDisplayContent();
}

// ── Event Listeners ───────────────────────────────────────────
function setupEventListeners() {
    // Filter kategori
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            currentCategory = e.currentTarget.dataset.category;
            categoryBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            await filterAndDisplayContent();
        });
    });

    // Pencarian dengan debounce
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                currentSearchQuery = e.target.value;
                await filterAndDisplayContent();
            }, 300);
        });
    }
}

// ── Filter + Render ───────────────────────────────────────────
async function filterAndDisplayContent() {
    showLoading(true);

    const { data, error } = await window.contentDB.filterContent(
        currentCategory === 'Semua' ? null : currentCategory,
        currentSearchQuery
    );

    if (error) {
        window.showToast('Gagal memuat konten', 'error');
        showLoading(false);
        return;
    }

    filteredContent = data || [];
    await renderContentGrid();
    showLoading(false);
}

// ── Render Grid ───────────────────────────────────────────────
async function renderContentGrid() {
    if (!contentGrid) return;

    if (filteredContent.length === 0) {
        contentGrid.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon"><i class="fas fa-search"></i></div>
                <h3>Tidak ada konten ditemukan</h3>
                <p>Coba kata kunci atau kategori lain</p>
            </div>`;
        return;
    }

    // FIX: Satu request untuk semua status like (bukan N+1)
    const sessionId = window.getSessionId();
    const { likedIds } = await window.contentDB.checkMultipleLikeStatus(
        filteredContent.map(c => c.id),
        sessionId
    );

    let html = '';
    filteredContent.forEach((content, index) => {
        const liked = likedIds.has(content.id);
        const color = CATEGORY_COLORS[content.category] || '#4A90E2';

        html += `
            <div class="card" data-id="${content.id}" style="--i:${index}">
                <div class="card-thumbnail">
                    <img src="${content.thumbnail_url || DEFAULT_THUMBNAIL}"
                         alt="${content.title}"
                         loading="lazy"
                         onerror="this.src='${DEFAULT_THUMBNAIL}'">
                    <span class="category-badge" style="background:${color}">
                        ${content.category}
                    </span>
                </div>
                <div class="card-content">
                    <h3 class="card-title">${content.title}</h3>
                    <div class="card-meta">
                        <span><i class="far fa-calendar"></i> ${content.year || 'N/A'}</span>
                        <span><i class="far fa-clock"></i> ${content.duration || 'N/A'}</span>
                        <span><i class="fas fa-star" style="color:#F5A623"></i> ${content.rating || 'N/A'}</span>
                    </div>
                    <p class="card-description">${window.truncateText(content.description, 100)}</p>
                    <div class="card-tags">
                        ${(content.tags || []).slice(0, 3).map(t => `<span class="tag">${t}</span>`).join('')}
                    </div>
                    <div class="card-footer">
                        <button class="like-btn ${liked ? 'liked' : ''}"
                                onclick="handleLike('${content.id}', this)">
                            <i class="${liked ? 'fas' : 'far'} fa-heart"></i>
                            <span class="like-count">${content.likes || 0}</span>
                        </button>
                        <a href="detail.html?id=${content.id}" class="read-more">
                            Selengkapnya <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                </div>
            </div>`;
    });

    contentGrid.innerHTML = html;
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

// ── Loading ───────────────────────────────────────────────────
function showLoading(show) {
    if (loadingSpinner) loadingSpinner.classList.toggle('hidden', !show);
    if (contentGrid)    contentGrid.classList.toggle('loading', show);
}

// Expose globally
window.handleLike = handleLike;
