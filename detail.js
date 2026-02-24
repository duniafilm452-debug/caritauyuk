// ============================================================
//  js/detail.js — Logika halaman detail
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');

  if (!id) {
    window.location.href = 'index.html';
    return;
  }

  loadDetail(parseInt(id));
});

async function loadDetail(id) {
  // Ambil data konten berdasarkan ID
  const { data, error } = await supabaseClient
    .from(TABLE_CONTENT)
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    window.location.href = 'index.html';
    return;
  }

  renderDetail(data);
  loadRelated(data.category, data.id);

  // Update meta title halaman
  document.title = `${data.title} — Cari Tau Yuk!`;
}

function renderDetail(d) {
  // Sembunyikan loading, tampilkan konten
  document.getElementById('pageLoading').style.display  = 'none';
  document.getElementById('detailWrapper').style.display = '';

  // ── Media ────────────────────────────────────────────────
  const mediaEl = document.getElementById('detailMedia');
  if (d.youtube_id) {
    mediaEl.innerHTML = `
      <iframe src="https://www.youtube.com/embed/${d.youtube_id}?rel=0"
              frameborder="0" allow="encrypted-media; fullscreen"
              allowfullscreen title="${escHtml(d.title)}"></iframe>`;
  } else if (d.video_url) {
    mediaEl.innerHTML = `
      <video src="${d.video_url}" controls
             poster="${d.thumbnail_url || ''}">
      </video>`;
  } else {
    mediaEl.innerHTML = `
      <img src="${d.thumbnail_url || 'https://placehold.co/800x450/13131a/444?text=No+Image'}"
           alt="${escHtml(d.title)}"/>`;
  }

  // ── Badge ────────────────────────────────────────────────
  document.getElementById('detailBadge').innerHTML =
    `<span class="card-badge badge-${d.category}" style="position:static">${d.category}</span>`;

  // ── Title & meta ─────────────────────────────────────────
  document.getElementById('detailTitle').textContent = d.title;
  document.getElementById('detailMeta').textContent  =
    [d.year, d.duration, d.rating && d.rating !== '—' ? `⭐ ${d.rating}` : null]
      .filter(Boolean).join(' · ');

  // ── Tags ─────────────────────────────────────────────────
  document.getElementById('detailTags').innerHTML =
    (d.tags || []).map(t => `<span class="tag">${escHtml(t)}</span>`).join('');

  // ── Description ──────────────────────────────────────────
  document.getElementById('detailDesc').textContent = d.description || '';

  // ── Affiliate ────────────────────────────────────────────
  const affBlock = document.getElementById('affiliateBlock');
  if (d.affiliate_url) {
    affBlock.classList.remove('hidden');
    document.getElementById('affiliateBadge').textContent     = d.affiliate_badge || 'Partner';
    document.getElementById('affiliateDesc').textContent      = d.affiliate_desc  || '';
    document.getElementById('affiliateLinkLabel').textContent = d.affiliate_label || 'Kunjungi';
    document.getElementById('affiliateLink').href             = d.affiliate_url;
  } else {
    affBlock.classList.add('hidden');
  }
}

async function loadRelated(category, excludeId) {
  const { data } = await supabaseClient
    .from(TABLE_CONTENT)
    .select('id, title, category, thumbnail_url')
    .eq('category', category)
    .neq('id', excludeId)
    .limit(5);

  const container = document.getElementById('relatedContent');

  if (!data || !data.length) {
    container.innerHTML = `<p style="color:var(--muted);font-size:.85rem">Tidak ada konten terkait.</p>`;
    return;
  }

  const catColor = {
    film: 'var(--film)', sains: 'var(--sains)',
    teknologi: 'var(--teknologi)', ai: 'var(--ai)',
    kesehatan: 'var(--kesehatan)'
  };

  container.innerHTML = data.map(r => `
    <a class="related-card" href="detail.html?id=${r.id}">
      <img class="related-thumb"
           src="${r.thumbnail_url || 'https://placehold.co/90x68/1c1c26/444?text=...'}"
           alt="${escHtml(r.title)}" loading="lazy"/>
      <div class="related-info">
        <span class="related-cat" style="color:${catColor[r.category] || 'var(--accent)'}">
          ${r.category}
        </span>
        <span class="related-title">${escHtml(r.title)}</span>
      </div>
    </a>
  `).join('');
}

function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
