// ============================================================
// detail.js v2.1 — Logika halaman detail konten
// Fixes: Supabase client detection, IP timeout, error boundary,
//        realtime guard, maybeSingle, utils integration
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.contentDB === 'undefined') {
        console.error('contentDB tidak ditemukan. Pastikan db.js dimuat.');
        return;
    }
    await initializeDetail();
});

// ── URL Parsing ───────────────────────────────────────────────
// Mendukung 3 format URL:
//   1. Clean URL  : /panduan-investasi-saham-untuk-pemula  (baru)
//   2. Query slug : /detail.html?slug=panduan-investasi-...  (lama)
//   3. Query id   : /detail.html?id=UUID                     (paling lama)
const _urlParams   = new URLSearchParams(window.location.search);
const _pathParts   = window.location.pathname.replace(/^\//, '').split('/').filter(Boolean);

// Clean URL: path punya 1 segmen → /slug-artikel
// Abaikan jika segmen adalah file .html
const _firstPart   = _pathParts[0] || '';
const contentSlug  = (_pathParts.length === 1 && !_firstPart.endsWith('.html'))
    ? _firstPart
    : _urlParams.get('slug');

const contentId    = _urlParams.get('id');   // fallback UUID lama

const detailMain     = document.querySelector('.detail-main');
const detailSidebar  = document.querySelector('.detail-sidebar');
const loadingSpinner = document.getElementById('loadingSpinner');

// ── Init ──────────────────────────────────────────────────────
async function initializeDetail() {
    // Dukung ?slug= (baru) dan ?id= (lama/backward compat)
    if (!contentSlug && !contentId) { window.location.href = '404.html'; return; }
    await loadContentDetail();
    setupEventListeners();
}

function setupEventListeners() {
    const backBtn = document.querySelector('.back-button');
    if (backBtn) {
        backBtn.addEventListener('click', e => { e.preventDefault(); window.history.back(); });
    }
}

async function loadContentDetail() {
    showLoading(true);

    let content, error;

    if (contentSlug) {
        // ── Query by slug (SEO-friendly URL) ──────────────────
        // Gunakan Supabase client langsung dengan .eq('slug', slug)
        // CATATAN: ganti 'content' dengan nama tabel yang sesuai di Supabase Anda
        const sb = getSupabaseClient();
        if (!sb) { showLoading(false); window.location.href = '404.html'; return; }
        const res = await sb
            .from('content')        // ← sesuaikan dengan nama tabel Anda
            .select('*')
            .eq('slug', contentSlug)
            .maybeSingle();
        content = res.data;
        error   = res.error;
    } else {
        // ── Fallback: query by UUID (URL lama / backward compat)
        const res = await window.contentDB.getContentById(contentId);
        content = res.data;
        error   = res.error;
    }

    if (error || !content) { showLoading(false); window.location.href = '404.html'; return; }

    const sessionId             = window.getSessionId();
    const { liked }             = await window.contentDB.checkLikeStatus(content.id, sessionId);
    const { data: related }     = await window.contentDB.getRelatedContent(content.category, content.id, 5);

    renderMainContent(content, liked);
    renderSidebar(related || []);

    // ── Update meta tags & title untuk SEO ───────────────────
    updatePageMeta(content);

    initCommentSystem(content.id);   // non-blocking — tidak di-await

    showLoading(false);
}

// ── Update Meta Tags Dinamis (SEO) ───────────────────────────
function updatePageMeta(content) {
    const cleanUrl  = window.buildArticleUrl(content);
    const fullUrl   = 'https://yukcaritau.my.id' + cleanUrl;
    const pageTitle = (content.title || 'Detail') + ' — Cari tau yuk';
    const desc      = (content.description || '').replace(/<[^>]+>/g, '').slice(0, 160);
    const img       = content.thumbnail_url || '';

    // Update <title>
    document.title = pageTitle;

    // Update canonical
    const canonical = document.getElementById('canonicalUrl');
    if (canonical) canonical.href = fullUrl;

    // Update Open Graph
    const set = (id, attr, val) => {
        const el = document.getElementById(id);
        if (el) el.setAttribute(attr, val);
    };
    set('ogTitle',           'content', pageTitle);
    set('ogDescription',     'content', desc);
    set('ogUrl',             'content', fullUrl);
    set('ogImage',           'content', img);
    set('twitterTitle',      'content', pageTitle);
    set('twitterDescription','content', desc);
}

// ── Render Main ───────────────────────────────────────────────
function renderMainContent(content, liked) {
    if (!detailMain) return;

    const esc = window.escapeHtml;
    detailMain.innerHTML = `
        <div class="media-player">${renderMedia(content)}</div>
        <div class="content-info">
            <h1 class="content-title">${esc(content.title)}</h1>
            <div class="content-meta">
                <span class="meta-item"><i class="fas fa-film"></i> ${esc(content.category)}</span>
                <span class="meta-item"><i class="far fa-calendar"></i> ${esc(content.year || 'N/A')}</span>
                <span class="meta-item"><i class="far fa-clock"></i> ${esc(content.duration || 'N/A')}</span>
                <span class="meta-item"><i class="fas fa-star" style="color:#F5A623"></i> ${esc(String(content.rating || 'N/A'))}</span>
            </div>
            <div class="content-description">${content.description || 'Tidak ada deskripsi.'}</div>
            <div class="content-tags">
                ${(content.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join('')}
            </div>
            <div class="content-actions">
                <button class="btn btn-like ${liked ? 'liked' : ''}"
                        data-id="${esc(content.id)}"
                        id="mainLikeBtn">
                    <i class="${liked ? 'fas' : 'far'} fa-heart"></i>
                    <span class="like-count">${content.likes || 0}</span> Suka
                </button>
                <button class="btn btn-outline" id="mainShareBtn">
                    <i class="fas fa-share-alt"></i> Bagikan
                </button>
            </div>
            ${renderAffiliateBlock(content)}
        </div>`;

    // FIX: Event listener langsung, bukan inline onclick — aman dari XSS
    document.getElementById('mainLikeBtn')?.addEventListener('click', function () {
        handleLike(content.id, this);
    });
    document.getElementById('mainShareBtn')?.addEventListener('click', shareContent);

    addShareButtons();
}

function renderMedia(content) {
    const esc = window.escapeHtml;
    if (content.youtube_id) {
        return `<iframe src="https://www.youtube.com/embed/${esc(content.youtube_id)}"
                    title="${esc(content.title)}"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen></iframe>`;
    }
    if (content.video_url) {
        return `<video controls>
                    <source src="${esc(content.video_url)}" type="video/mp4">
                    Browser Anda tidak mendukung tag video.
                </video>`;
    }
    if (content.thumbnail_url) {
        return `<img src="${esc(content.thumbnail_url)}" alt="${esc(content.title)}">`;
    }
    return `<div class="media-placeholder">
                <i class="fas fa-play-circle"></i>
                <h3>${esc(content.title)}</h3>
                <p>Klik tombol play untuk menonton</p>
            </div>`;
}

function renderAffiliateBlock(content) {
    if (!content.affiliate_url || !content.affiliate_label) return '';
    const esc = window.escapeHtml;
    return `
        <div class="affiliate-block">
            ${content.affiliate_badge ? `<span class="affiliate-badge">${esc(content.affiliate_badge)}</span>` : ''}
            <h3 class="affiliate-title">${esc(content.affiliate_label)}</h3>
            ${content.affiliate_desc ? `<p class="affiliate-desc">${esc(content.affiliate_desc)}</p>` : ''}
            <a href="${esc(content.affiliate_url)}" class="affiliate-link" target="_blank" rel="nofollow sponsored">
                ${esc(content.affiliate_label)} <i class="fas fa-arrow-right"></i>
            </a>
        </div>`;
}

// ── Render Sidebar ────────────────────────────────────────────
function renderSidebar(relatedContent) {
    if (!detailSidebar) return;
    const esc = window.escapeHtml;
    const adHtml = `<div class="ad-slot sidebar-widget"><span>Iklan 300x250</span></div>`;

    let relatedHtml = '';
    if (relatedContent.length > 0) {
        relatedHtml = `
            <div class="sidebar-widget">
                <h4 class="sidebar-title">Konten Terkait</h4>
                <ul class="related-list">
                    ${relatedContent.map(item => `
                        <li class="related-item">
                            <img src="${esc(item.thumbnail_url || DEFAULT_THUMBNAIL)}"
                                 alt="${esc(item.title)}"
                                 class="related-thumbnail"
                                 onerror="this.src='${DEFAULT_THUMBNAIL}'">
                            <div class="related-info">
                                <a href="${window.buildArticleUrl(item)}" class="related-title">${esc(item.title)}</a>
                                <div class="related-meta">
                                    <span><i class="fas fa-heart"></i> ${item.likes || 0}</span>
                                    <span><i class="far fa-clock"></i> ${esc(item.duration || 'N/A')}</span>
                                </div>
                            </div>
                        </li>`).join('')}
                </ul>
            </div>`;
    }

    detailSidebar.innerHTML = adHtml + relatedHtml + adHtml;
}

// ── Share ─────────────────────────────────────────────────────
function addShareButtons() {
    const c = document.createElement('div');
    c.className = 'share-buttons';
    const url   = encodeURIComponent(location.href);
    const title = encodeURIComponent(document.title);
    c.innerHTML = `
        <a href="https://www.facebook.com/sharer/sharer.php?u=${url}"
           target="_blank" rel="noopener" class="share-btn share-facebook" title="Bagikan ke Facebook">
            <i class="fab fa-facebook-f"></i>
        </a>
        <a href="https://twitter.com/intent/tweet?url=${url}&text=${title}"
           target="_blank" rel="noopener" class="share-btn share-twitter" title="Bagikan ke Twitter">
            <i class="fab fa-twitter"></i>
        </a>
        <a href="https://wa.me/?text=${encodeURIComponent(document.title + ' ' + location.href)}"
           target="_blank" rel="noopener" class="share-btn share-whatsapp" title="Bagikan ke WhatsApp">
            <i class="fab fa-whatsapp"></i>
        </a>
        <a href="https://t.me/share/url?url=${url}&text=${title}"
           target="_blank" rel="noopener" class="share-btn share-telegram" title="Bagikan ke Telegram">
            <i class="fab fa-telegram-plane"></i>
        </a>`;
    const actions = document.querySelector('.content-actions');
    if (actions) actions.after(c);
}

async function shareContent() {
    if (navigator.share) {
        try {
            await navigator.share({
                title : document.title,
                text  : document.querySelector('.content-description')?.textContent || '',
                url   : location.href,
            });
            window.showToast('Terima kasih telah berbagi!', 'success');
        } catch (e) {
            if (e.name !== 'AbortError') console.error(e);
        }
    } else {
        navigator.clipboard.writeText(location.href)
            .then(()  => window.showToast('Link disalin ke clipboard!', 'success'))
            .catch(() => window.showToast('Gagal menyalin link', 'error'));
    }
}

// ── Like Konten ───────────────────────────────────────────────
async function handleLike(cid, buttonEl) {
    try {
        const sessionId        = window.getSessionId();
        const { liked, error } = await window.contentDB.likeContent(cid, sessionId);
        if (error) { window.showToast('Gagal memproses like', 'error'); return; }

        const icon  = buttonEl.querySelector('i');
        const count = buttonEl.querySelector('.like-count');
        const cur   = parseInt(count.textContent) || 0;

        if (liked) {
            buttonEl.classList.add('liked');
            icon.className    = 'fas fa-heart';
            count.textContent = cur + 1;
            window.showToast('Konten disukai! ❤️', 'success');
        } else {
            buttonEl.classList.remove('liked');
            icon.className    = 'far fa-heart';
            count.textContent = Math.max(0, cur - 1);
            window.showToast('Like dibatalkan', 'info');
        }
    } catch (err) {
        console.error('handleLike:', err);
        window.showToast('Terjadi kesalahan', 'error');
    }
}

// ── Loading ───────────────────────────────────────────────────
function showLoading(show) {
    if (loadingSpinner) loadingSpinner.classList.toggle('hidden', !show);
}


// ╔══════════════════════════════════════════════════════════════╗
// ║   SISTEM KOMENTAR v2.1 — Full fix + utils.js integration    ║
// ╚══════════════════════════════════════════════════════════════╝

const MAX_COMMENT_LENGTH = 500;
let _commentSortOrder  = 'desc';
let _commentsCollapsed = false;
let _currentUser       = null;
let _cachedIp          = null;

// ── FIX #1: Deteksi Supabase Client yang Benar ────────────────
// window.supabase = library object BUKAN initialized client.
// config.js kini mengekspos window._supabase = createClient(...).
// Fungsi ini menelusuri semua kemungkinan nama variabel.
function getSupabaseClient() {
    // Cek window._supabase terlebih dahulu (disimpan di config.js yang sudah diperbaiki)
    if (window._supabase && typeof window._supabase.from === 'function') return window._supabase;

    // Fallback: client yang mungkin disimpan di nama lain
    const candidates = ['supabaseClient', 'sb', 'dbClient', 'db', '_db', 'client'];
    for (const name of candidates) {
        if (window[name] && typeof window[name].from === 'function') {
            console.log('[comments] Supabase client ditemukan di window.' + name);
            return window[name];
        }
    }

    // Coba ambil dari dalam objek contentDB
    if (window.contentDB) {
        for (const prop of ['supabase', 'client', '_client']) {
            if (window.contentDB[prop] && typeof window.contentDB[prop].from === 'function') {
                return window.contentDB[prop];
            }
        }
    }

    console.warn('[comments] Supabase client tidak ditemukan. Periksa config.js.');
    return null;
}

// ── FIX #2: IP Fetch dengan Manual Timeout ────────────────────
// AbortSignal.timeout() tidak didukung semua browser → fetch hang
// selamanya → Promise.all tidak resolve → skeleton stuck.
function _fetchWithTimeout(url, ms) {
    return new Promise((resolve, reject) => {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        fetch(url, { signal: ctrl.signal })
            .then(r  => { clearTimeout(timer); resolve(r); })
            .catch(e => { clearTimeout(timer); reject(e); });
    });
}

async function getUserIp() {
    if (_cachedIp) return _cachedIp;
    try {
        const res  = await _fetchWithTimeout('https://api.ipify.org?format=json', 3000);
        const data = await res.json();
        if (data?.ip) { _cachedIp = data.ip; return _cachedIp; }
    } catch { /* timeout atau error — lanjut ke fallback */ }

    // Fallback: UUID persisten di localStorage
    let uid = localStorage.getItem('_cty_uid');
    if (!uid) {
        uid = 'anon_' + Math.random().toString(36).slice(2, 10)
                      + Math.random().toString(36).slice(2, 6);
        localStorage.setItem('_cty_uid', uid);
    }
    _cachedIp = uid;
    return _cachedIp;
}

// ── Generator Nama Acak ───────────────────────────────────────
const _ADJ  = ['Bintang','Angin','Hujan','Cahaya','Langit','Bulan','Awan','Pelangi','Badai',
                'Embun','Fajar','Senja','Topan','Mega','Kabut','Aurora','Galaksi','Komet','Laut','Gunung'];
const _NOUN = ['Perkasa','Sejuk','Deras','Abadi','Cerah','Terang','Lembut','Kencang','Tenang',
               'Hangat','Tajam','Damai','Agung','Megah','Ceria','Gigih','Setia','Berani','Cerdas','Bijak'];

function generateUsername() {
    const a   = _ADJ[Math.floor(Math.random() * _ADJ.length)];
    const n   = _NOUN[Math.floor(Math.random() * _NOUN.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${a}${n}${num}`;
}

// ── Get / Create Comment User ─────────────────────────────────
async function getOrCreateCommentUser() {
    if (_currentUser) return _currentUser;

    const ip = await getUserIp();
    const sb = getSupabaseClient();

    if (!sb) {
        // Fallback localStorage jika Supabase tidak tersedia
        let u = JSON.parse(localStorage.getItem('_cty_comment_user') || 'null');
        if (!u) {
            u = { ip_address: ip, username: generateUsername() };
            localStorage.setItem('_cty_comment_user', JSON.stringify(u));
        }
        _currentUser = u;
        return _currentUser;
    }

    try {
        // FIX: Gunakan maybeSingle() — tidak throw error jika row tidak ada
        const { data: existing, error: fetchErr } = await sb
            .from('comment_users').select('*').eq('ip_address', ip).maybeSingle();
        if (fetchErr) throw fetchErr;

        if (existing) {
            _currentUser = existing;
            return _currentUser;
        }

        // Buat pengguna baru
        const newUser = { ip_address: ip, username: generateUsername() };
        const { data: created, error: insertErr } = await sb
            .from('comment_users').insert([newUser]).select().single();
        if (insertErr) throw insertErr;

        _currentUser = created || newUser;
    } catch (e) {
        console.error('[comments] getOrCreateCommentUser:', e.message || e);
        // Fallback agar tidak crash total
        let u = JSON.parse(localStorage.getItem('_cty_comment_user') || 'null');
        if (!u) {
            u = { ip_address: ip, username: generateUsername() };
            localStorage.setItem('_cty_comment_user', JSON.stringify(u));
        }
        _currentUser = u;
    }

    return _currentUser;
}

// ── Fetch Comments ────────────────────────────────────────────
async function fetchComments(cid, order = 'desc') {
    const sb = getSupabaseClient();
    if (!sb) return [];
    try {
        const { data, error } = await sb
            .from('comments').select('*')
            .eq('content_id', cid)
            .order('created_at', { ascending: order === 'asc' });
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('[comments] fetchComments:', e.message || e);
        return [];
    }
}

// ── FIX #3: initCommentSystem dengan Error Boundary ───────────
// Skeleton tidak akan pernah stuck — jika ada error apapun,
// ditampilkan state error + tombol "Coba Lagi".
async function initCommentSystem(cid) {
    const section = document.querySelector('.comments-section');
    if (!section) return;

    // Tampilkan skeleton sementara
    section.innerHTML = `
        <div style="padding:var(--sp-md) 0">
            <div style="width:45%;height:20px;margin-bottom:16px;border-radius:8px;
                        background:var(--border);animation:skelPulse 1.4s infinite"></div>
            <div style="width:100%;height:88px;margin-bottom:10px;border-radius:10px;
                        background:var(--border);animation:skelPulse 1.4s infinite .1s"></div>
            <div style="width:28%;height:36px;margin-bottom:24px;border-radius:8px;
                        background:var(--border);animation:skelPulse 1.4s infinite .2s"></div>
            <div class="skel-comment" style="animation:skelPulse 1.4s infinite .3s"></div>
            <div class="skel-comment" style="opacity:.5;animation:skelPulse 1.4s infinite .45s"></div>
        </div>`;

    try {
        const [user, comments] = await Promise.all([
            getOrCreateCommentUser(),
            fetchComments(cid, _commentSortOrder),
        ]);
        renderCommentSection(section, cid, user, comments);
        subscribeToComments(cid, user);
    } catch (err) {
        console.error('[comments] initCommentSystem fatal:', err);
        section.innerHTML = `
            <div style="padding:var(--sp-xl);text-align:center;color:var(--text-light)">
                <i class="fas fa-exclamation-circle"
                   style="font-size:2rem;margin-bottom:var(--sp-md);display:block;color:#ef4444"></i>
                <p style="font-weight:600;margin-bottom:6px">Gagal memuat komentar</p>
                <p style="font-size:.85rem;margin-bottom:var(--sp-lg)">
                    Periksa koneksi internet atau konfigurasi Supabase.
                </p>
                <button class="btn btn-outline" id="retryCommentBtn">
                    <i class="fas fa-redo"></i> Coba Lagi
                </button>
            </div>`;
        document.getElementById('retryCommentBtn')
            ?.addEventListener('click', () => initCommentSystem(cid));
    }
}

// ── Render Comment Section ────────────────────────────────────
function renderCommentSection(section, cid, user, comments) {
    const esc      = window.escapeHtml;
    const likedSet = getLikedComments(cid);

    section.innerHTML = `
        <div class="comments-header">
            <div class="comments-title-wrap">
                <i class="fas fa-comments" style="color:var(--primary);font-size:1.05rem"></i>
                <h4 class="comments-heading">Komentar</h4>
                <span class="comment-count-badge" id="commentCountBadge">${comments.length}</span>
            </div>
            <div class="comments-header-actions">
                <div class="comment-sort-group">
                    <button class="sort-btn ${_commentSortOrder === 'desc' ? 'active' : ''}"
                            data-sort="desc">
                        <i class="fas fa-arrow-down"></i> Terbaru
                    </button>
                    <button class="sort-btn ${_commentSortOrder === 'asc' ? 'active' : ''}"
                            data-sort="asc">
                        <i class="fas fa-arrow-up"></i> Terlama
                    </button>
                </div>
                <button class="comments-toggle-btn" id="commentsToggleBtn">
                    <i class="fas fa-${_commentsCollapsed ? 'chevron-down' : 'chevron-up'}"></i>
                    <span id="toggleBtnLabel">${_commentsCollapsed ? 'Perluas' : 'Perkecil'}</span>
                </button>
            </div>
        </div>

        <div class="comments-body ${_commentsCollapsed ? 'collapsed' : ''}" id="commentsBody">
            <div class="comment-form-wrapper">
                <div class="comment-user-chip">
                    <div class="comment-avatar comment-avatar-chip">
                        ${esc(user.username.charAt(0).toUpperCase())}
                    </div>
                    <div>
                        <div class="comment-chip-label">Berkomentar sebagai</div>
                        <strong class="comment-chip-name">${esc(user.username)}</strong>
                    </div>
                </div>
                <div class="comment-textarea-wrap" id="commentTextareaWrap">
                    <textarea id="commentText" class="comment-input"
                        placeholder="Tulis komentar Anda… (maks. ${MAX_COMMENT_LENGTH} karakter)"
                        rows="3" maxlength="${MAX_COMMENT_LENGTH}"></textarea>
                    <div class="char-counter">
                        <span id="charCountNum">0</span> / ${MAX_COMMENT_LENGTH}
                    </div>
                </div>
                <button class="btn btn-primary comment-submit-btn" id="submitCommentBtn">
                    <i class="fas fa-paper-plane"></i> Kirim Komentar
                </button>
            </div>

            <ul class="comment-list" id="commentList">
                ${buildCommentItems(comments, user.ip_address, likedSet, cid)}
            </ul>
        </div>`;

    // FIX: Semua event listener via JS, bukan inline onclick
    _bindCommentEvents(section, cid, user);
}

// ── Bind Event Listeners untuk Komentar ──────────────────────
function _bindCommentEvents(section, cid, user) {
    // Textarea char counter
    const textarea = section.querySelector('#commentText');
    if (textarea) {
        textarea.addEventListener('input', () => updateCharCount(textarea));
    }

    // Tombol kirim
    section.querySelector('#submitCommentBtn')
        ?.addEventListener('click', () => postComment(cid, user));

    // Tombol sort
    section.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => setCommentSort(btn.dataset.sort, cid));
    });

    // Tombol toggle collapse
    section.querySelector('#commentsToggleBtn')
        ?.addEventListener('click', toggleComments);

    // Event delegation untuk like & delete di daftar komentar
    const list = section.querySelector('#commentList');
    if (list) {
        list.addEventListener('click', async e => {
            const likeBtn   = e.target.closest('.comment-like-btn');
            const deleteBtn = e.target.closest('.comment-delete-btn');

            if (likeBtn) {
                const commentId = likeBtn.dataset.commentId;
                await toggleCommentLike(commentId, cid, likeBtn);
            } else if (deleteBtn) {
                const commentId = deleteBtn.dataset.commentId;
                await deleteComment(commentId, cid);
            }
        });
    }
}

// ── Build Comment Items HTML ──────────────────────────────────
function buildCommentItems(comments, currentIp, likedSet, cid) {
    const esc = window.escapeHtml;

    if (!comments.length) {
        return `<li class="comment-empty">
                    <i class="far fa-comment-dots"></i>
                    <p>Belum ada komentar. Jadilah yang pertama berkomentar!</p>
                </li>`;
    }

    return comments.map(c => {
        const isOwn   = c.ip_address === currentIp;
        const isLiked = likedSet.has(c.id);
        const init    = (c.username || 'A').charAt(0).toUpperCase();

        // FIX: Gunakan window.formatTimeAgo dari utils.js (sudah ada global)
        const timeAgo = window.formatTimeAgo(c.created_at);

        return `
            <li class="comment-item ${isOwn ? 'own-comment' : ''}" id="ci-${esc(c.id)}">
                <div class="comment-avatar">${esc(init)}</div>
                <div class="comment-content">
                    <div class="comment-header">
                        <div class="comment-author-group">
                            <span class="comment-author">${esc(c.username || 'Anonim')}</span>
                            ${isOwn ? '<span class="badge-you">Anda</span>' : ''}
                        </div>
                        <span class="comment-date"
                              title="${new Date(c.created_at).toLocaleString('id-ID')}">
                            ${timeAgo}
                        </span>
                    </div>
                    <div class="comment-text">${esc(c.text)}</div>
                    <div class="comment-footer-actions">
                        <button class="comment-action-btn comment-like-btn ${isLiked ? 'liked' : ''}"
                                data-comment-id="${esc(c.id)}">
                            <i class="${isLiked ? 'fas' : 'far'} fa-thumbs-up"></i>
                            <span>${c.likes || 0}</span>
                        </button>
                        ${isOwn ? `
                        <button class="comment-action-btn comment-delete-btn"
                                data-comment-id="${esc(c.id)}">
                            <i class="fas fa-trash-alt"></i> Hapus
                        </button>` : ''}
                    </div>
                </div>
            </li>`;
    }).join('');
}

// ── Kirim Komentar ────────────────────────────────────────────
async function postComment(cid, user) {
    const textEl = document.getElementById('commentText');
    const btn    = document.getElementById('submitCommentBtn');
    if (!textEl || !btn) return;

    const text = textEl.value.trim();
    if (!text)                        { window.showToast('Komentar tidak boleh kosong.', 'error'); textEl.focus(); return; }
    if (text.length < 3)              { window.showToast('Komentar terlalu singkat (min. 3 karakter).', 'error'); textEl.focus(); return; }
    if (text.length > MAX_COMMENT_LENGTH) { window.showToast(`Maks. ${MAX_COMMENT_LENGTH} karakter.`, 'error'); return; }

    const sb = getSupabaseClient();
    if (!sb) { window.showToast('Supabase tidak tersambung. Periksa config.js.', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim…';

    try {
        const { error } = await sb.from('comments').insert([{
            content_id : cid,
            ip_address : user.ip_address,
            username   : user.username,
            text,
            likes      : 0,
        }]);
        if (error) throw error;

        textEl.value = '';
        updateCharCount(textEl);
        window.showToast('Komentar berhasil dikirim! 💬', 'success');
        await refreshCommentList(cid);
    } catch (e) {
        console.error('[comments] postComment:', e);
        window.showToast('Gagal mengirim komentar. Coba lagi.', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Komentar';
}

// ── Hapus Komentar ────────────────────────────────────────────
async function deleteComment(commentId, cid) {
    const ok = await showConfirmDialog(
        'Hapus Komentar?',
        'Komentar ini akan dihapus permanen dan tidak bisa dikembalikan.',
        'Hapus', 'Batal'
    );
    if (!ok) return;

    const user = await getOrCreateCommentUser();
    const sb   = getSupabaseClient();
    if (!sb) return;

    try {
        const { error } = await sb.from('comments').delete()
            .eq('id', commentId)
            .eq('ip_address', user.ip_address);  // keamanan server-side
        if (error) throw error;

        // Animasi keluar
        const el = document.getElementById(`ci-${commentId}`);
        if (el) { el.classList.add('removing'); setTimeout(() => el.remove(), 300); }

        await refreshCommentList(cid, false);
        window.showToast('Komentar dihapus.', 'info');
    } catch (e) {
        console.error('[comments] deleteComment:', e);
        window.showToast('Gagal menghapus komentar.', 'error');
    }
}

// ── Like Komentar ─────────────────────────────────────────────
async function toggleCommentLike(commentId, cid, btn) {
    const sb       = getSupabaseClient();
    const likedSet = getLikedComments(cid);
    const isLiked  = likedSet.has(commentId);
    const countEl  = btn.querySelector('span');
    const iconEl   = btn.querySelector('i');
    const cur      = parseInt(countEl.textContent) || 0;
    const newLikes = isLiked ? Math.max(0, cur - 1) : cur + 1;

    // Optimistic UI update
    countEl.textContent = newLikes;
    if (isLiked) {
        btn.classList.remove('liked'); iconEl.className = 'far fa-thumbs-up';
        likedSet.delete(commentId);
    } else {
        btn.classList.add('liked'); iconEl.className = 'fas fa-thumbs-up';
        likedSet.add(commentId);
    }
    saveLikedComments(cid, likedSet);

    if (sb) {
        const { error } = await sb.from('comments').update({ likes: newLikes }).eq('id', commentId);
        if (error) {
            // Rollback jika gagal
            countEl.textContent = cur;
            if (isLiked) { btn.classList.add('liked'); iconEl.className = 'fas fa-thumbs-up'; likedSet.add(commentId); }
            else         { btn.classList.remove('liked'); iconEl.className = 'far fa-thumbs-up'; likedSet.delete(commentId); }
            saveLikedComments(cid, likedSet);
            window.showToast('Gagal memproses like.', 'error');
        }
    }
}

// ── Refresh Daftar Komentar ───────────────────────────────────
async function refreshCommentList(cid, scrollToTop = true) {
    const listEl = document.getElementById('commentList');
    const badge  = document.getElementById('commentCountBadge');
    if (!listEl) return;

    const user     = await getOrCreateCommentUser();
    const comments = await fetchComments(cid, _commentSortOrder);
    const liked    = getLikedComments(cid);

    listEl.innerHTML = buildCommentItems(comments, user.ip_address, liked, cid);
    if (badge) badge.textContent = comments.length;

    // Re-bind event listener setelah re-render
    const section = document.querySelector('.comments-section');
    if (section) {
        const list = section.querySelector('#commentList');
        if (list) {
            list.addEventListener('click', async e => {
                const likeBtn   = e.target.closest('.comment-like-btn');
                const deleteBtn = e.target.closest('.comment-delete-btn');
                if (likeBtn)   await toggleCommentLike(likeBtn.dataset.commentId, cid, likeBtn);
                if (deleteBtn) await deleteComment(deleteBtn.dataset.commentId, cid);
            });
        }
    }

    if (scrollToTop) listEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Sort ──────────────────────────────────────────────────────
async function setCommentSort(order, cid) {
    if (_commentSortOrder === order) return;
    _commentSortOrder = order;
    document.querySelectorAll('.sort-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === order);
    });
    await refreshCommentList(cid, false);
}

// ── Toggle Collapse / Expand ──────────────────────────────────
function toggleComments() {
    _commentsCollapsed = !_commentsCollapsed;
    const body   = document.getElementById('commentsBody');
    const icon   = document.querySelector('#commentsToggleBtn i');
    const label  = document.getElementById('toggleBtnLabel');
    if (body)  body.classList.toggle('collapsed', _commentsCollapsed);
    if (icon)  icon.className  = `fas fa-${_commentsCollapsed ? 'chevron-down' : 'chevron-up'}`;
    if (label) label.textContent = _commentsCollapsed ? 'Perluas' : 'Perkecil';
}

// ── FIX #4: Realtime dengan Guard yang Benar ──────────────────
// Gunakan getSupabaseClient() bukan window.supabase (library object)
function subscribeToComments(cid, user) {
    const sb = getSupabaseClient();
    if (!sb || typeof sb.channel !== 'function') {
        console.warn('[comments] Realtime tidak tersedia.');
        return;
    }
    try {
        sb.channel(`comments_cid_${cid}`)
            .on('postgres_changes', {
                event  : 'INSERT',
                schema : 'public',
                table  : 'comments',
                filter : `content_id=eq.${cid}`,
            }, async payload => {
                // Hanya refresh jika komentar dari orang lain
                if (payload.new?.ip_address !== user.ip_address) {
                    await refreshCommentList(cid, false);
                    window.showToast('Ada komentar baru! 💬', 'info');
                }
            })
            .subscribe();
    } catch (e) {
        console.warn('[comments] Realtime subscribe gagal:', e.message);
    }
}

// ── Char Counter ──────────────────────────────────────────────
function updateCharCount(textarea) {
    const el   = document.getElementById('charCountNum');
    const wrap = document.getElementById('commentTextareaWrap');
    const len  = textarea.value.length;
    if (el) el.textContent = len;
    if (wrap) {
        wrap.classList.toggle('near-limit', len >= MAX_COMMENT_LENGTH * 0.8 && len < MAX_COMMENT_LENGTH);
        wrap.classList.toggle('at-limit',   len >= MAX_COMMENT_LENGTH);
    }
}

// ── Like Comment Storage ──────────────────────────────────────
function getLikedComments(cid) {
    try { return new Set(JSON.parse(localStorage.getItem(`_cty_liked_${cid}`) || '[]')); }
    catch { return new Set(); }
}
function saveLikedComments(cid, set) {
    localStorage.setItem(`_cty_liked_${cid}`, JSON.stringify([...set]));
}

// ── Confirm Dialog ────────────────────────────────────────────
function showConfirmDialog(title, message, confirmLabel = 'Ya', cancelLabel = 'Batal') {
    return new Promise(resolve => {
        document.getElementById('confirmDialog')?.remove();

        const overlay = document.createElement('div');
        overlay.id        = 'confirmDialog';
        overlay.className = 'confirm-overlay';
        overlay.innerHTML = `
            <div class="confirm-box">
                <div class="confirm-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <h4 class="confirm-title">${title}</h4>
                <p class="confirm-message">${message}</p>
                <div class="confirm-actions">
                    <button class="btn btn-outline confirm-cancel">${cancelLabel}</button>
                    <button class="btn btn-danger confirm-ok">${confirmLabel}</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('visible'));

        const done = result => {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 250);
            resolve(result);
        };

        overlay.querySelector('.confirm-ok').addEventListener('click',     () => done(true));
        overlay.querySelector('.confirm-cancel').addEventListener('click', () => done(false));
        overlay.addEventListener('click', e => { if (e.target === overlay) done(false); });
    });
}