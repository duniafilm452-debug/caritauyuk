// ============================================================
//  js/admin.js — Logika Admin (Login via Supabase Auth)
// ============================================================

let allRows      = [];
let deleteTarget = null;

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Cek sesi login yang masih aktif
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    showPanel(session.user);
  }

  // Preview thumbnail
  const thumbInput = document.getElementById('fThumbnail');
  if (thumbInput) thumbInput.addEventListener('input', previewThumb);
});

// ═══════════════════════════════════════════════════════════
//  AUTH — Supabase Email + Password
//  Buat akun admin di: Supabase → Authentication → Users → Add User
// ═══════════════════════════════════════════════════════════
async function doLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  const btn      = document.getElementById('loginBtn');

  if (!email || !password) {
    showLoginError('Email dan password tidak boleh kosong.');
    return;
  }

  btn.textContent = 'Memuat…';
  btn.disabled    = true;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  btn.textContent = 'Masuk';
  btn.disabled    = false;

  if (error) {
    showLoginError('Email atau password salah.');
    return;
  }

  errEl.classList.add('hidden');
  showPanel(data.user);
}

async function doLogout() {
  await supabaseClient.auth.signOut();
  document.getElementById('adminPanel').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginEmail').value    = '';
  document.getElementById('loginPassword').value = '';
  allRows = [];
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showPanel(user) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminPanel').classList.remove('hidden');

  // Tampilkan email user di sidebar
  const email  = user.email || 'admin';
  const avatar = email.charAt(0).toUpperCase();
  document.getElementById('userEmail').textContent  = email;
  document.getElementById('userAvatar').textContent = avatar;

  loadAllContent();
}

function togglePasswordView() {
  const input   = document.getElementById('loginPassword');
  const isText  = input.type === 'text';
  input.type    = isText ? 'password' : 'text';
  document.getElementById('eyeIcon').style.opacity = isText ? '1' : '.4';
}

// ═══════════════════════════════════════════════════════════
//  LOAD DATA
// ═══════════════════════════════════════════════════════════
async function loadAllContent() {
  const { data, error } = await supabaseClient
    .from(TABLE_CONTENT)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { showToast('Gagal memuat data: ' + error.message, 'error'); return; }

  allRows = data || [];
  renderTable(allRows);
  updateStats(allRows);
}

function updateStats(rows) {
  document.getElementById('statTotal').textContent     = rows.length;
  document.getElementById('statFilm').textContent      = rows.filter(r => r.category === 'film').length;
  document.getElementById('statSains').textContent     = rows.filter(r => r.category === 'sains').length;
  document.getElementById('statTeknologi').textContent = rows.filter(r => r.category === 'teknologi').length;
  document.getElementById('statAi').textContent        = rows.filter(r => r.category === 'ai').length;
  document.getElementById('statKesehatan').textContent = rows.filter(r => r.category === 'kesehatan').length;
}

// ═══════════════════════════════════════════════════════════
//  RENDER TABLE
// ═══════════════════════════════════════════════════════════
function renderTable(rows) {
  const tbody = document.getElementById('contentTableBody');

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Belum ada konten.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>
        <img class="row-thumb"
             src="${r.thumbnail_url || 'https://placehold.co/60x45/1c1c26/444?text=—'}"
             alt="" onerror="this.src='https://placehold.co/60x45/1c1c26/444?text=—'"/>
      </td>
      <td>
        <div class="row-title-main">${escHtml(r.title)}</div>
        <div class="row-title-sub">${r.year || '—'} · ${r.duration || '—'}</div>
      </td>
      <td>
        <span class="card-badge badge-${r.category}" style="position:static">${r.category}</span>
      </td>
      <td>❤️ ${r.likes || 0}</td>
      <td>
        <span class="aff-pill ${r.affiliate_url ? 'yes' : 'no'}">
          ${r.affiliate_url ? '✓ Ada' : '— Tidak'}
        </span>
      </td>
      <td>
        <div class="action-btns">
          <button class="btn btn-edit btn-sm" onclick="openEdit(${r.id})">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>
          <button class="btn btn-delete btn-sm" onclick="openDeleteModal(${r.id})">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
            Hapus
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ═══════════════════════════════════════════════════════════
//  FILTER
// ═══════════════════════════════════════════════════════════
function filterList() {
  const q   = document.getElementById('adminSearch').value.toLowerCase();
  const cat = document.getElementById('adminCatFilter').value;

  const filtered = allRows.filter(r => {
    const matchQ   = !q   || r.title.toLowerCase().includes(q);
    const matchCat = !cat || r.category === cat;
    return matchQ && matchCat;
  });

  renderTable(filtered);
}

// ═══════════════════════════════════════════════════════════
//  TAB NAVIGATION
// ═══════════════════════════════════════════════════════════
function switchTab(tab, activeBtn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  document.getElementById(tab === 'list' ? 'tabList' : 'tabAdd').classList.remove('hidden');
  if (activeBtn) activeBtn.classList.add('active');

  const titles = { list: 'Daftar Konten', add: 'Tambah Konten' };
  document.getElementById('topbarTitle').textContent = titles[tab] || '';

  // Tutup sidebar di mobile
  document.getElementById('adminSidebar').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════
//  FORM
// ═══════════════════════════════════════════════════════════
function openEdit(id) {
  const row = allRows.find(r => r.id === id);
  if (!row) return;

  document.getElementById('editId').value        = row.id;
  document.getElementById('fTitle').value        = row.title           || '';
  document.getElementById('fCategory').value     = row.category        || '';
  document.getElementById('fYear').value         = row.year            || '';
  document.getElementById('fDuration').value     = row.duration        || '';
  document.getElementById('fRating').value       = (row.rating && row.rating !== '—') ? row.rating : '';
  document.getElementById('fThumbnail').value    = row.thumbnail_url   || '';
  document.getElementById('fYoutubeId').value    = row.youtube_id      || '';
  document.getElementById('fVideoUrl').value     = row.video_url       || '';
  document.getElementById('fDescription').value  = row.description     || '';
  document.getElementById('fTags').value         = (row.tags || []).join(', ');
  document.getElementById('fAffUrl').value       = row.affiliate_url   || '';
  document.getElementById('fAffLabel').value     = row.affiliate_label || '';
  document.getElementById('fAffDesc').value      = row.affiliate_desc  || '';
  document.getElementById('fAffBadge').value     = row.affiliate_badge || '';

  previewThumb();

  document.getElementById('topbarTitle').textContent  = 'Edit Konten';
  document.getElementById('submitBtn').innerHTML       =
    `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
       <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
       <polyline points="17 21 17 13 7 13 7 21"/>
       <polyline points="7 3 7 8 15 8"/>
     </svg> Update Konten`;

  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('navAdd').classList.add('active');
  document.getElementById('tabList').classList.add('hidden');
  document.getElementById('tabAdd').classList.remove('hidden');
  document.getElementById('adminSidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  document.getElementById('editId').value    = '';
  document.getElementById('fTitle').value       = '';
  document.getElementById('fCategory').value    = '';
  document.getElementById('fYear').value        = '';
  document.getElementById('fDuration').value    = '';
  document.getElementById('fRating').value      = '';
  document.getElementById('fThumbnail').value   = '';
  document.getElementById('fYoutubeId').value   = '';
  document.getElementById('fVideoUrl').value    = '';
  document.getElementById('fDescription').value = '';
  document.getElementById('fTags').value        = '';
  document.getElementById('fAffUrl').value      = '';
  document.getElementById('fAffLabel').value    = '';
  document.getElementById('fAffDesc').value     = '';
  document.getElementById('fAffBadge').value    = '';

  removeThumbnail();
  document.getElementById('topbarTitle').textContent = 'Tambah Konten';
  document.getElementById('submitBtn').innerHTML     =
    `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
       <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
       <polyline points="17 21 17 13 7 13 7 21"/>
       <polyline points="7 3 7 8 15 8"/>
     </svg> Simpan Konten`;
}

function previewThumb() {
  const url  = document.getElementById('fThumbnail').value.trim();
  const wrap = document.getElementById('thumbPreview');
  const img  = document.getElementById('thumbImg');
  if (url) {
    wrap.classList.remove('hidden');
    img.src = url;
    img.onerror = () => wrap.classList.add('hidden');
  } else {
    wrap.classList.add('hidden');
  }
}

function removeThumbnail() {
  document.getElementById('fThumbnail').value = '';
  document.getElementById('thumbPreview').classList.add('hidden');
  document.getElementById('thumbImg').src = '';
}

// ═══════════════════════════════════════════════════════════
//  SUBMIT
// ═══════════════════════════════════════════════════════════
async function submitForm() {
  const title    = document.getElementById('fTitle').value.trim();
  const category = document.getElementById('fCategory').value;
  const desc     = document.getElementById('fDescription').value.trim();

  if (!title || !category || !desc) {
    showToast('Judul, kategori, dan deskripsi wajib diisi.', 'error');
    return;
  }

  const btn    = document.getElementById('submitBtn');
  const editId = document.getElementById('editId').value;
  btn.disabled = true;
  btn.textContent = 'Menyimpan…';

  const ratingVal = document.getElementById('fRating').value.trim();

  const payload = {
    title,
    category,
    year:            document.getElementById('fYear').value.trim()      || null,
    duration:        document.getElementById('fDuration').value.trim()  || null,
    rating:          ratingVal || '—',
    thumbnail_url:   document.getElementById('fThumbnail').value.trim() || null,
    youtube_id:      document.getElementById('fYoutubeId').value.trim() || null,
    video_url:       document.getElementById('fVideoUrl').value.trim()  || null,
    description:     desc,
    tags:            parseTags(document.getElementById('fTags').value),
    affiliate_url:   document.getElementById('fAffUrl').value.trim()    || null,
    affiliate_label: document.getElementById('fAffLabel').value.trim()  || null,
    affiliate_desc:  document.getElementById('fAffDesc').value.trim()   || null,
    affiliate_badge: document.getElementById('fAffBadge').value.trim()  || null,
  };

  let error;
  if (editId) {
    ({ error } = await supabaseClient.from(TABLE_CONTENT).update(payload).eq('id', parseInt(editId)));
  } else {
    ({ error } = await supabaseClient.from(TABLE_CONTENT).insert(payload));
  }

  btn.disabled = false;

  if (error) {
    showToast('Gagal menyimpan: ' + error.message, 'error');
    btn.innerHTML = editId ? 'Update Konten' : 'Simpan Konten';
    return;
  }

  showToast(editId ? '✅ Konten berhasil diupdate!' : '✅ Konten berhasil ditambahkan!', 'success');
  resetForm();
  switchTab('list', document.getElementById('navList'));
  loadAllContent();
}

function parseTags(str) {
  return str.split(',').map(t => t.trim()).filter(t => t.length > 0);
}

// ═══════════════════════════════════════════════════════════
//  DELETE
// ═══════════════════════════════════════════════════════════
function openDeleteModal(id) {
  deleteTarget = id;
  document.getElementById('deleteModal').classList.add('open');
}

function closeDeleteModal() {
  deleteTarget = null;
  document.getElementById('deleteModal').classList.remove('open');
}

async function confirmDelete() {
  if (!deleteTarget) return;
  const { error } = await supabaseClient.from(TABLE_CONTENT).delete().eq('id', deleteTarget);
  closeDeleteModal();
  if (error) { showToast('Gagal menghapus: ' + error.message, 'error'); return; }
  showToast('🗑️ Konten berhasil dihapus.', 'success');
  loadAllContent();
}

// ═══════════════════════════════════════════════════════════
//  SIDEBAR TOGGLE (mobile)
// ═══════════════════════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('adminSidebar').classList.toggle('open');
}

// ═══════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════
let toastTimer = null;
function showToast(msg, type = 'success') {
  const el     = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ── Utility ───────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
