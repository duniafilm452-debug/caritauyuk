// ============================================================
//  js/app.js — UI Logic & Render
// ============================================================

/* ─── State ─────────────────────────────────────────────── */
let currentCat  = 'semua';
let searchQuery = '';
let allContent  = [];
let likedIds    = new Set();
let searchTimer = null;

/* ─── Init ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  setupCategoryButtons();
  setupSearch();
  loadContent();
});

/* ─── Load content from Supabase ─────────────────────────── */
async function loadContent(cat = currentCat, q = searchQuery) {
  setLoading(true);
  allContent = await fetchContent(cat, q);

  if (allContent.length) {
    likedIds = await fetchMyLikes(allContent.map(d => d.id));
  }

  renderGrid(allContent);
  updateSectionMeta(allContent.length);
  setLoading(false);
}

/* ─── Render grid ────────────────────────────────────────── */
function renderGrid(items) {
  const grid     = document.getElementById('grid');
  const noResult = document.getElementById('noResult');

  if (!items.length) {
    grid.innerHTML = '';
    noResult.classList.add('show');
    return;
  }

  noResult.classList.remove('show');
  grid.innerHTML = items.map((d, i) => cardHTML(d, i)).join('');
}

function cardHTML(d, i) {
  const liked    = likedIds.has(d.id);
  const hasVideo = d.youtube_id || d.video_url;

  return `
  <article class="card" style="animation-delay:${i * 0.05}s" data-id="${d.id}">

    <!-- Klik thumbnail → ke halaman detail -->
    <a class="card-media" href="detail.html?id=${d.id}">
      <img src="${d.thumbnail_url || 'https://placehold.co/600x338/13131a/444?text=No+Image'}"
           alt="${escHtml(d.title)}" loading="lazy"/>
      ${hasVideo ? `
        <div class="play-btn" aria-label="Putar video">
          <div class="play-circle">
            <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>` : ''}
      <span class="card-badge badge-${d.category}">${d.category}</span>
    </a>

    <!-- Klik teks → ke halaman detail -->
    <a class="card-body" href="detail.html?id=${d.id}" style="text-decoration:none;display:block">
      <div class="card-meta">
        <span>${d.year || '—'}</span>
        <span class="dot"></span>
        <span>${d.duration || '—'}</span>
        ${d.rating && d.rating !== '—'
          ? `<span class="dot"></span><span>⭐ ${d.rating}</span>`
          : ''}
      </div>
      <h2 class="card-title">${escHtml(d.title)}</h2>
      <p class="card-desc">${escHtml(d.description || '')}</p>
    </a>

    <div class="card-footer">
      <div class="tags">
        ${(d.tags || []).slice(0, 2).map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}
        ${d.affiliate_url ? `<span class="tag tag-affiliate">🔗 Affiliasi</span>` : ''}
      </div>
      <button class="like-btn ${liked ? 'liked' : ''}"
              onclick="handleLike(event, ${d.id})"
              aria-label="Like konten">
        <svg width="15" height="15"
             fill="${liked ? 'currentColor' : 'none'}"
             stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span class="like-count">${d.likes || 0}</span>
      </button>
    </div>
  </article>`;
}

/* ─── Like ───────────────────────────────────────────────── */
async function handleLike(e, id) {
  e.stopPropagation();
  e.preventDefault();

  const btn   = e.currentTarget;
  const svg   = btn.querySelector('svg');
  const count = btn.querySelector('.like-count');

  // Optimistic UI
  const wasLiked = likedIds.has(id);
  count.textContent = parseInt(count.textContent) + (wasLiked ? -1 : 1);
  btn.classList.toggle('liked', !wasLiked);
  svg.setAttribute('fill', wasLiked ? 'none' : 'currentColor');

  // Supabase
  const { liked, newCount } = await toggleLike(id);
  count.textContent = newCount;
  btn.classList.toggle('liked', liked);
  svg.setAttribute('fill', liked ? 'currentColor' : 'none');

  if (liked) likedIds.add(id); else likedIds.delete(id);

  const item = allContent.find(x => x.id === id);
  if (item) item.likes = newCount;
}

/* ─── Category & Search ─────────────────────────────────── */
function setupCategoryButtons() {
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      loadContent(currentCat, searchQuery);
    });
  });
}

function setupSearch() {
  document.getElementById('searchInput').addEventListener('input', e => {
    searchQuery = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadContent(currentCat, searchQuery), 350);
  });
}

/* ─── Section meta ───────────────────────────────────────── */
function updateSectionMeta(total) {
  const catNames = {
    semua: 'Semua Konten', film: '🎬 Film',
    sains: '🔬 Sains', teknologi: '💻 Teknologi',
    ai: '🤖 AI', kesehatan: '🌿 Kesehatan'
  };
  document.getElementById('sectionTitle').textContent = catNames[currentCat] || 'Konten';
  document.getElementById('countBadge').textContent   = `${total} konten`;
}

/* ─── Loading ────────────────────────────────────────────── */
function setLoading(on) {
  document.getElementById('loadingState').classList.toggle('show', on);
  document.getElementById('grid').style.opacity = on ? '0.4' : '1';
}

/* ─── Utility ────────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
