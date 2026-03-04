// ============================================================
// app.js — Logika halaman utama dengan sistem rekomendasi
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.contentDB === 'undefined') {
        console.error('contentDB tidak ditemukan. Pastikan db.js dimuat dengan benar.');
        return;
    }
    await initializeApp();
});

// ── State ─────────────────────────────────────────────────────
let currentCategory    = 'Semua';
let currentSearchQuery = '';
let currentTab         = 'foryou';  // 'foryou' | 'trending' | 'latest'
let allContent         = [];
let filteredContent    = [];

// ── DOM Elements ──────────────────────────────────────────────
const contentGrid    = document.getElementById('contentGrid');
const categoryBtns   = document.querySelectorAll('.category-btn');
const searchInput    = document.getElementById('searchInput');
const loadingSpinner = document.getElementById('loadingSpinner');
const feedTabs       = document.querySelectorAll('.feed-tab');
const tabDescription = document.getElementById('tabDescription');

// ── Preference Storage ─────────────────────────────────────────
const PREF_KEY = 'cty_user_prefs';

function loadPrefs() {
    try {
        return JSON.parse(localStorage.getItem(PREF_KEY)) || {
            categories : {},   // { "Film": 5, "Teknologi": 2, ... }
            liked      : [],   // array of liked content IDs
            viewed     : [],   // array of viewed content IDs (last 50)
            lastVisit  : null,
        };
    } catch {
        return { categories: {}, liked: [], viewed: [], lastVisit: null };
    }
}

function savePrefs(prefs) {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {}
}

function trackCategoryClick(category) {
    if (category === 'Semua') return;
    const p = loadPrefs();
    p.categories[category] = (p.categories[category] || 0) + 1;
    savePrefs(p);
}

function trackLike(contentId, category, isLiked) {
    const p = loadPrefs();
    if (isLiked) {
        if (!p.liked.includes(contentId)) p.liked.push(contentId);
        p.categories[category] = (p.categories[category] || 0) + 3;
    } else {
        p.liked = p.liked.filter(id => id !== contentId);
    }
    savePrefs(p);
}

function trackView(contentId, category) {
    const p = loadPrefs();
    p.viewed      = [contentId, ...p.viewed.filter(id => id !== contentId)].slice(0, 50);
    p.categories[category] = (p.categories[category] || 0) + 0.5;
    p.lastVisit   = Date.now();
    savePrefs(p);
}

// ── Recommendation Engine ──────────────────────────────────────
function getTopPreferredCategory(prefs) {
    const cats = prefs.categories;
    return Object.entries(cats).sort((a, b) => b[1] - a[1]).map(e => e[0]);
}

function scoreContent(content, prefs) {
    let score = 0;
    const catScore = prefs.categories[content.category] || 0;
    score += catScore * 3;
    if (prefs.liked.includes(content.id)) score += 8;
    const viewIdx = prefs.viewed.indexOf(content.id);
    if (viewIdx !== -1) score += Math.max(0, 3 - viewIdx * 0.1);
    score += Math.log1p(content.likes || 0) * 1.5;
    if (content.created_at) {
        const daysOld = (Date.now() - new Date(content.created_at)) / 86400000;
        if (daysOld < 14) score += (14 - daysOld) * 0.4;
    }
    return score;
}

function hasEnoughHistory(prefs) {
    const total = Object.values(prefs.categories).reduce((a, b) => a + b, 0);
    return total >= 3 || prefs.liked.length >= 1 || prefs.viewed.length >= 3;
}

function buildRecommended(contents) {
    const prefs = loadPrefs();
    if (!hasEnoughHistory(prefs)) return null;
    return [...contents].sort((a, b) => scoreContent(b, prefs) - scoreContent(a, prefs));
}

function buildTrending(contents) {
    return [...contents].sort((a, b) => (b.likes || 0) - (a.likes || 0));
}

function buildLatest(contents) {
    return [...contents].sort((a, b) => {
        if (!a.created_at && !b.created_at) return 0;
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return new Date(b.created_at) - new Date(a.created_at);
    });
}

// ── Tab Description ────────────────────────────────────────────
function updateTabDescription(tab) {
    if (!tabDescription) return;
    const prefs   = loadPrefs();
    const topCats = getTopPreferredCategory(prefs).slice(0, 2);
    const messages = {
        foryou: hasEnoughHistory(prefs) && topCats.length
            ? `Dipilih khusus untukmu berdasarkan minatmu di <strong>${topCats.join(' & ')}</strong> ✨`
            : `Jelajahi konten pilihan — <a href="#" id="buildProfileHint" style="color:var(--primary)">like atau klik kategori</a> untuk rekomendasi personal! 🎯`,
        trending : 'Konten yang paling banyak disukai pengguna saat ini 🔥',
        latest   : 'Konten terbaru yang baru saja ditambahkan 🕐',
    };
    tabDescription.innerHTML = messages[tab] || '';
}

// ── Init ──────────────────────────────────────────────────────
async function initializeApp() {
    const params      = new URLSearchParams(window.location.search);
    const paramCat    = params.get('category');
    const paramSearch = params.get('search');
    const paramTab    = params.get('tab');

    if (paramCat && ['Film','Teknologi','Keuangan','Kesehatan','Lainnya','Semua'].includes(paramCat)) {
        currentCategory = paramCat;
        currentTab = 'latest';
    }
    if (paramSearch) currentSearchQuery = paramSearch;
    if (paramTab && ['foryou','trending','latest'].includes(paramTab)) currentTab = paramTab;

    categoryBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.category === currentCategory));
    feedTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === currentTab));
    if (searchInput && paramSearch) searchInput.value = paramSearch;

    const prefs   = loadPrefs();
    prefs.lastVisit = Date.now();
    savePrefs(prefs);

    setupEventListeners();
    await loadAndDisplayContent();
}

// ── Event Listeners ───────────────────────────────────────────
function setupEventListeners() {
    // Tab switch
    feedTabs.forEach(tab => {
        tab.addEventListener('click', async (e) => {
            currentTab = e.currentTarget.dataset.tab;
            feedTabs.forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            await loadAndDisplayContent();
        });
    });

    // Filter kategori
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            currentCategory = e.currentTarget.dataset.category;
            trackCategoryClick(currentCategory);
            categoryBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            // FIX: await agar loading state benar
            await applyFilterAndRender();
        });
    });

    // Pencarian dengan debounce
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                currentSearchQuery = e.target.value;
                await applyFilterAndRender();
            }, 300);
        });
    }
}

// ── Load All + Display ─────────────────────────────────────────
async function loadAndDisplayContent() {
    showLoading(true);
    updateTabDescription(currentTab);

    const { data, error } = await window.contentDB.filterContent(null, '');
    if (error) {
        window.showToast('Gagal memuat konten', 'error');
        showLoading(false);
        return;
    }

    allContent = data || [];
    // FIX: await agar showLoading(false) baru dipanggil setelah render selesai
    await applyFilterAndRender();
    showLoading(false);
}

// ── Filter + Sort berdasarkan Tab aktif ────────────────────────
// FIX: Fungsi ini sekarang async karena renderContentGrid adalah async
async function applyFilterAndRender() {
    let base = [...allContent];

    if (currentCategory !== 'Semua') {
        base = base.filter(c => c.category === currentCategory);
    }

    if (currentSearchQuery.trim()) {
        const q = currentSearchQuery.toLowerCase();
        base = base.filter(c =>
            c.title?.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q) ||
            (c.tags || []).some(t => t.toLowerCase().includes(q))
        );
    }

    switch (currentTab) {
        case 'foryou': {
            const recommended = buildRecommended(base);
            filteredContent   = recommended || buildLatest(base);
            break;
        }
        case 'trending':
            filteredContent = buildTrending(base);
            break;
        case 'latest':
        default:
            filteredContent = buildLatest(base);
            break;
    }

    const noHistory = currentTab === 'foryou' && !hasEnoughHistory(loadPrefs());
    // FIX: await renderContentGrid
    await renderContentGrid(noHistory);
}

// ── Render Grid ───────────────────────────────────────────────
async function renderContentGrid(showNewUserHint = false) {
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

    const sessionId = window.getSessionId();
    const { likedIds } = await window.contentDB.checkMultipleLikeStatus(
        filteredContent.map(c => c.id),
        sessionId
    );

    // Sync liked ke prefs lokal
    const prefs = loadPrefs();
    likedIds.forEach(id => { if (!prefs.liked.includes(id)) prefs.liked.push(id); });
    savePrefs(prefs);

    let html = '';

    if (showNewUserHint) {
        html += `
        <div class="new-user-hint">
            <div class="hint-icon">🎯</div>
            <div>
                <strong>Bangun profil rekomendasimu!</strong>
                <p>Klik kategori favorit, like konten yang kamu suka, atau buka artikel — sistem kami akan belajar seleramu secara otomatis.</p>
            </div>
        </div>`;
    }

    const prefs2  = loadPrefs();
    const topCat  = getTopPreferredCategory(prefs2)[0];

    filteredContent.forEach((content, index) => {
        const liked     = likedIds.has(content.id);
        const color     = CATEGORY_COLORS[content.category] || '#4A90E2';
        const isTrending  = currentTab === 'trending' && index < 3;
        const isTopPick   = currentTab === 'foryou' && index === 0 && hasEnoughHistory(prefs2);

        let ribbonHtml = '';
        if (isTrending) {
            const medals = ['🥇', '🥈', '🥉'];
            ribbonHtml = `<div class="card-ribbon trending-ribbon">${medals[index]} Trending</div>`;
        } else if (isTopPick) {
            ribbonHtml = `<div class="card-ribbon pick-ribbon">⭐ Top Untukmu</div>`;
        } else if (currentTab === 'latest' && index === 0) {
            ribbonHtml = `<div class="card-ribbon new-ribbon">🆕 Terbaru</div>`;
        }

        // FIX: Hindari inline onclick dengan data-id yang mengandung karakter berbahaya.
        // Simpan id & category sebagai data-attribute lalu tangkap via event delegation.
        // Escape nilai untuk keamanan atribut HTML.
        const safeId       = window.escapeHtml(content.id);
        const safeCategory = window.escapeHtml(content.category);
        const safeTitle    = window.escapeHtml(content.title);

        html += `
            <div class="card"
                 data-id="${safeId}"
                 data-category="${safeCategory}"
                 style="--i:${index}">
                <a href="detail.html?id=${safeId}" class="card-link" aria-label="${safeTitle}">
                    <div class="card-thumbnail">
                        <img src="${content.thumbnail_url || DEFAULT_THUMBNAIL}"
                             alt="${safeTitle}"
                             loading="lazy"
                             onerror="this.src='${DEFAULT_THUMBNAIL}'">
                        <span class="category-badge" style="background:${color}">
                            ${safeCategory}
                        </span>
                        ${ribbonHtml}
                    </div>
                    <div class="card-content">
                        <h3 class="card-title">${safeTitle}</h3>
                        <div class="card-meta">
                            <span><i class="far fa-calendar"></i> ${content.year || 'N/A'}</span>
                            <span><i class="far fa-clock"></i> ${content.duration || 'N/A'}</span>
                            <span><i class="fas fa-star" style="color:#F5A623"></i> ${content.rating || 'N/A'}</span>
                        </div>
                        <p class="card-description">${window.truncateText(content.description, 100)}</p>
                        <div class="card-tags">
                            ${(content.tags || []).slice(0, 3).map(t => `<span class="tag">${window.escapeHtml(t)}</span>`).join('')}
                        </div>
                    </div>
                </a>
                <div class="card-footer">
                    <button class="like-btn ${liked ? 'liked' : ''}"
                            data-id="${safeId}"
                            data-category="${safeCategory}"
                            aria-label="Suka">
                        <i class="${liked ? 'fas' : 'far'} fa-heart"></i>
                        <span class="like-count">${content.likes || 0}</span>
                    </button>
                    <a href="detail.html?id=${safeId}" class="read-more">
                        Selengkapnya <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </div>`;
    });

    contentGrid.innerHTML = html;
}

// ── Event Delegation untuk Like & Track View ──────────────────
// FIX: Ganti inline onclick dengan event delegation untuk keamanan
// dan agar tidak perlu expose window.handleLike / window.trackCardView
if (contentGrid) {
    contentGrid.addEventListener('click', async (e) => {
        // Like button
        const likeBtn = e.target.closest('.like-btn');
        if (likeBtn) {
            e.preventDefault();
            e.stopPropagation();
            const { id, category } = likeBtn.dataset;
            await handleLike(id, category, likeBtn);
            return;
        }

        // Card click (track view) — navigasi dilakukan oleh <a> di dalam card
        const card = e.target.closest('.card');
        if (card && !e.target.closest('.card-footer')) {
            const { id, category } = card.dataset;
            if (id && category) trackView(id, category);
        }
    });
}

// ── Like Handler ──────────────────────────────────────────────
async function handleLike(contentId, category, buttonEl) {
    try {
        const sessionId       = window.getSessionId();
        const { liked, error } = await window.contentDB.likeContent(contentId, sessionId);

        if (error) { window.showToast('Gagal memproses like', 'error'); return; }

        const icon  = buttonEl.querySelector('i');
        const count = buttonEl.querySelector('.like-count');
        const cur   = parseInt(count.textContent) || 0;

        trackLike(contentId, category, liked);

        if (liked) {
            buttonEl.classList.add('liked');
            icon.className = 'fas fa-heart';
            count.textContent = cur + 1;
            window.showToast('Konten disukai! ❤️', 'success');
        } else {
            buttonEl.classList.remove('liked');
            icon.className = 'far fa-heart';
            count.textContent = Math.max(0, cur - 1);
            window.showToast('Like dibatalkan', 'info');
        }

        if (currentTab === 'foryou') updateTabDescription('foryou');
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
