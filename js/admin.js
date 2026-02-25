// ============================================================
// admin.js — Admin Panel Logic
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.contentDB === 'undefined') {
        console.error('contentDB tidak ditemukan. Pastikan db.js dimuat dengan benar.');
        return;
    }
    initializeAdmin();
});

let currentUser = null;
let contentList = [];
let currentFilter = { search: '', category: 'Semua' };

// ── DOM Elements ──────────────────────────────────────────────
const loginSection    = document.getElementById('loginSection');
const adminSection    = document.getElementById('adminSection');
const loginForm       = document.getElementById('loginForm');
const logoutBtn       = document.getElementById('logoutBtn');
const contentTable    = document.getElementById('contentTable');
const addContentBtn   = document.getElementById('addContentBtn');
const contentForm     = document.getElementById('contentForm');
const filterSearch    = document.getElementById('filterSearch');
const filterCategory  = document.getElementById('filterCategory');
const statsContainer  = document.getElementById('statsContainer');

// ── Init ──────────────────────────────────────────────────────
function initializeAdmin() {
    checkAuth();
    setupEventListeners();
}

function setupEventListeners() {
    if (loginForm)     loginForm.addEventListener('submit', handleLogin);
    if (logoutBtn)     logoutBtn.addEventListener('click', handleLogout);
    if (addContentBtn) addContentBtn.addEventListener('click', () => openFormModal());
    if (contentForm)   contentForm.addEventListener('submit', handleContentSubmit);

    if (filterSearch) {
        let timeout;
        filterSearch.addEventListener('input', e => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                currentFilter.search = e.target.value;
                filterContent();
            }, 300);
        });
    }

    if (filterCategory) {
        filterCategory.addEventListener('change', e => {
            currentFilter.category = e.target.value;
            filterContent();
        });
    }

    const thumbInput = document.getElementById('thumbnail_url');
    if (thumbInput) thumbInput.addEventListener('input', e => updateThumbnailPreview(e.target.value));

    setupTagsInput();

    document.querySelectorAll('.modal-close, .modal .btn-outline').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
}

// ── Auth ──────────────────────────────────────────────────────
async function checkAuth() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;

        if (session) {
            currentUser = session.user;
            showAdminPanel();
            await loadAdminData();
        } else {
            showLoginPanel();
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        window.showToast('Gagal memeriksa autentikasi', 'error');
        showLoginPanel();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const orig = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        currentUser = data.user;
        window.showToast('Login berhasil!', 'success');
        showAdminPanel();
        await loadAdminData();
    } catch (error) {
        console.error('Login error:', error);
        window.showToast('Email atau password salah', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = orig;
    }
}

async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        currentUser = null;
        window.showToast('Logout berhasil', 'success');
        showLoginPanel();
    } catch (error) {
        console.error('Logout error:', error);
        window.showToast('Gagal logout', 'error');
    }
}

// ── Panel Visibility ──────────────────────────────────────────
function showLoginPanel() {
    if (loginSection) loginSection.classList.remove('hidden');
    if (adminSection) adminSection.classList.add('hidden');
}

function showAdminPanel() {
    if (loginSection) loginSection.classList.add('hidden');
    if (adminSection) adminSection.classList.remove('hidden');

    if (currentUser) {
        const nameEl   = document.getElementById('userName');
        const emailEl  = document.getElementById('userEmail');
        const avatarEl = document.getElementById('userAvatar');
        if (nameEl)   nameEl.textContent   = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Admin';
        if (emailEl)  emailEl.textContent  = currentUser.email;
        if (avatarEl) avatarEl.textContent = (currentUser.email?.[0] || 'A').toUpperCase();
    }
}

// ── Load Data ─────────────────────────────────────────────────
async function loadAdminData() {
    showLoading(true);
    await Promise.all([loadContentList(), loadStatistics()]);
    showLoading(false);
}

async function loadContentList() {
    const { data, error } = await window.contentDB.getAllContent();
    if (error) { window.showToast('Gagal memuat konten', 'error'); return; }
    contentList = data || [];
    renderContentTable(contentList);
}

// ── Table ─────────────────────────────────────────────────────
function renderContentTable(content) {
    if (!contentTable) return;

    if (content.length === 0) {
        contentTable.innerHTML = `
            <tr>
                <td colspan="7" class="empty-table">
                    <i class="fas fa-inbox"></i>
                    <p>Tidak ada konten</p>
                </td>
            </tr>`;
        return;
    }

    contentTable.innerHTML = content.map(item => `
        <tr>
            <td>
                <img src="${item.thumbnail_url || DEFAULT_THUMBNAIL}"
                     alt="${item.title}"
                     class="table-thumb"
                     onerror="this.src='${DEFAULT_THUMBNAIL}'">
            </td>
            <td class="td-title">${item.title}</td>
            <td><span class="cat-pill" style="background:${CATEGORY_COLORS[item.category] || '#4A90E2'}">${item.category}</span></td>
            <td>${item.year || '-'}</td>
            <td><span class="likes-badge"><i class="fas fa-heart"></i> ${item.likes || 0}</span></td>
            <td>${new Date(item.created_at).toLocaleDateString('id-ID')}</td>
            <td>
                <div class="table-actions">
                    <button class="table-btn table-btn-view"   onclick="viewContent('${item.id}')"    title="Lihat"><i class="fas fa-eye"></i></button>
                    <button class="table-btn table-btn-edit"   onclick="editContent('${item.id}')"    title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="table-btn table-btn-delete" onclick="confirmDelete('${item.id}')"  title="Hapus"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`).join('');
}

function filterContent() {
    let filtered = [...contentList];
    if (currentFilter.search) {
        const q = currentFilter.search.toLowerCase();
        filtered = filtered.filter(i =>
            i.title.toLowerCase().includes(q) ||
            (i.description && i.description.toLowerCase().includes(q))
        );
    }
    if (currentFilter.category && currentFilter.category !== 'Semua') {
        filtered = filtered.filter(i => i.category === currentFilter.category);
    }
    renderContentTable(filtered);
}

// ── Statistics ────────────────────────────────────────────────
async function loadStatistics() {
    const stats = {
        total      : contentList.length,
        film       : contentList.filter(c => c.category === 'Film').length,
        teknologi  : contentList.filter(c => c.category === 'Teknologi').length,
        keuangan   : contentList.filter(c => c.category === 'Keuangan').length,
        kesehatan  : contentList.filter(c => c.category === 'Kesehatan').length,
        totalLikes : contentList.reduce((s, c) => s + (c.likes || 0), 0),
    };

    if (statsContainer) {
        const cards = [
            { icon: 'newspaper',  value: stats.total,      label: 'Total Konten',  grad: '#4a90e2,#6c5ce7' },
            { icon: 'film',       value: stats.film,       label: 'Film',          grad: '#FF6B6B,#ee5a24' },
            { icon: 'microchip',  value: stats.teknologi,  label: 'Teknologi',     grad: '#4ECDC4,#44bd9c' },
            { icon: 'coins',      value: stats.keuangan,   label: 'Keuangan',      grad: '#45B7D1,#2980b9' },
            { icon: 'heartbeat',  value: stats.kesehatan,  label: 'Kesehatan',     grad: '#96CEB4,#27ae60' },
            { icon: 'heart',      value: stats.totalLikes, label: 'Total Likes',   grad: '#e84393,#c0392b' },
        ];

        statsContainer.innerHTML = cards.map((c, i) => `
            <div class="stat-card" style="--i:${i}">
                <div class="stat-icon" style="background:linear-gradient(135deg,${c.grad})">
                    <i class="fas fa-${c.icon}"></i>
                </div>
                <div class="stat-value">${c.value}</div>
                <div class="stat-label">${c.label}</div>
            </div>`).join('');
    }
}

// ── Form Modal ────────────────────────────────────────────────
function openFormModal(content = null) {
    const modal = document.getElementById('formModal');
    const title = document.getElementById('modalTitle');
    if (content) { title.textContent = 'Edit Konten'; fillForm(content); }
    else          { title.textContent = 'Tambah Konten Baru'; resetForm(); }
    modal.classList.add('show');
}

function fillForm(content) {
    const fields = ['contentId','category','title','year','duration','rating',
                    'thumbnail_url','youtube_id','video_url','description',
                    'affiliate_url','affiliate_label','affiliate_desc','affiliate_badge'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = content[id === 'contentId' ? 'id' : id] || '';
    });
    const tagsInput = document.getElementById('tags');
    if (content.tags && Array.isArray(content.tags)) {
        tagsInput.dataset.tags = JSON.stringify(content.tags);
        renderTags(content.tags);
    }
    updateThumbnailPreview(content.thumbnail_url);
}

function resetForm() {
    document.getElementById('contentId').value = '';
    document.getElementById('contentForm').reset();
    document.getElementById('tags').dataset.tags = '[]';
    renderTags([]);
    updateThumbnailPreview('');
}

async function handleContentSubmit(e) {
    e.preventDefault();
    const id        = document.getElementById('contentId').value;
    const submitBtn = contentForm.querySelector('button[type="submit"]');
    const orig      = submitBtn.innerHTML;

    const formData = {
        category       : document.getElementById('category').value,
        title          : document.getElementById('title').value,
        year           : parseInt(document.getElementById('year').value) || null,
        duration       : document.getElementById('duration').value,
        rating         : parseFloat(document.getElementById('rating').value) || null,
        thumbnail_url  : document.getElementById('thumbnail_url').value,
        youtube_id     : document.getElementById('youtube_id').value,
        video_url      : document.getElementById('video_url').value,
        description    : document.getElementById('description').value,
        tags           : JSON.parse(document.getElementById('tags').dataset.tags || '[]'),
        affiliate_url  : document.getElementById('affiliate_url').value,
        affiliate_label: document.getElementById('affiliate_label').value,
        affiliate_desc : document.getElementById('affiliate_desc').value,
        affiliate_badge: document.getElementById('affiliate_badge').value,
    };

    if (!formData.title || !formData.category) {
        window.showToast('Judul dan kategori harus diisi', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

    try {
        const result = id
            ? await window.contentDB.updateContent(id, formData)
            : await window.contentDB.createContent(formData);

        if (result.error) throw result.error;
        window.showToast(id ? 'Konten berhasil diupdate ✅' : 'Konten berhasil ditambahkan ✅', 'success');
        closeAllModals();
        await loadAdminData();
    } catch (error) {
        console.error('Error saving content:', error);
        window.showToast('Gagal menyimpan konten', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = orig;
    }
}

// ── CRUD Actions ──────────────────────────────────────────────
function viewContent(id)  { window.open(`detail.html?id=${id}`, '_blank'); }

function editContent(id) {
    const content = contentList.find(c => c.id === id);
    if (content) openFormModal(content);
}

function confirmDelete(id) {
    const modal      = document.getElementById('deleteModal');
    const confirmBtn = document.getElementById('confirmDelete');
    modal.classList.add('show');
    confirmBtn.onclick = async () => {
        await deleteContent(id);
        modal.classList.remove('show');
    };
}

async function deleteContent(id) {
    try {
        const { error } = await window.contentDB.deleteContent(id);
        if (error) throw error;
        window.showToast('Konten berhasil dihapus', 'success');
        await loadAdminData();
    } catch (error) {
        console.error('Error deleting content:', error);
        window.showToast('Gagal menghapus konten', 'error');
    }
}

// ── Tags ──────────────────────────────────────────────────────
function setupTagsInput() {
    const input = document.getElementById('tags');
    if (!input) return;
    if (!input.dataset.tags) input.dataset.tags = '[]';

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const tag = input.value.trim();
            if (tag) { addTag(tag); input.value = ''; }
        }
    });
    input.addEventListener('blur', () => {
        const tag = input.value.trim();
        if (tag) { addTag(tag); input.value = ''; }
    });
}

function addTag(tag) {
    const input = document.getElementById('tags');
    const tags  = JSON.parse(input.dataset.tags || '[]');
    if (!tags.includes(tag)) {
        tags.push(tag);
        input.dataset.tags = JSON.stringify(tags);
        renderTags(tags);
    }
}

function removeTag(tag) {
    const input = document.getElementById('tags');
    const tags  = JSON.parse(input.dataset.tags || '[]');
    const idx   = tags.indexOf(tag);
    if (idx > -1) {
        tags.splice(idx, 1);
        input.dataset.tags = JSON.stringify(tags);
        renderTags(tags);
    }
}

function renderTags(tags) {
    const container = document.querySelector('.tags-input-container');
    const input     = document.getElementById('tags');
    if (!container || !input) return;

    Array.from(container.children).forEach(child => {
        if (child !== input) child.remove();
    });

    tags.forEach(tag => {
        const el = document.createElement('span');
        el.className = 'tag-item';
        el.innerHTML = `${tag}<i class="fas fa-times" onclick="removeTag('${tag}')"></i>`;
        container.insertBefore(el, input);
    });
}

// ── Thumbnail Preview ─────────────────────────────────────────
function updateThumbnailPreview(url) {
    const preview = document.getElementById('thumbnailPreview');
    const img     = document.getElementById('previewImage');
    if (url && preview && img) { img.src = url; preview.classList.remove('hidden'); }
    else if (preview) { preview.classList.add('hidden'); }
}

// ── Modal & Loading ───────────────────────────────────────────
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.toggle('show', show);
}

// Expose globally
window.viewContent    = viewContent;
window.editContent    = editContent;
window.confirmDelete  = confirmDelete;
window.addTag         = addTag;
window.removeTag      = removeTag;
window.closeAllModals = closeAllModals;
