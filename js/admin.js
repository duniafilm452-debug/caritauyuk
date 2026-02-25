// ============================================================
// admin.js — Admin Panel Logic  (FIXED)
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
    // Setup UI listeners dulu — SELALU, tidak peduli DB ada atau tidak
    setupEventListeners();
    rteInit();

    // Baru cek DB dan mulai logika autentikasi
    if (typeof window.contentDB === 'undefined') {
        console.error('contentDB tidak ditemukan. Pastikan config.js, utils.js, db.js dimuat sebelum admin.js.');
        window.showToast && window.showToast('Koneksi database gagal', 'error');
        return;
    }
    checkAuth();
});

// ── State ─────────────────────────────────────────────────────
var currentUser   = null;
var contentList   = [];
var currentFilter = { search: '', category: 'Semua' };

// ── Event Listeners (selalu jalan) ────────────────────────────
function setupEventListeners() {

    // Login form
    var loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    // Logout
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Tombol Tambah Konten — desktop
    var addContentBtn = document.getElementById('addContentBtn');
    if (addContentBtn) {
        addContentBtn.addEventListener('click', function () {
            openFormModal();
        });
    }

    // Tombol Tambah Konten — mobile (di topbar)
    var addContentBtnMobile = document.getElementById('addContentBtnMobile');
    if (addContentBtnMobile) {
        addContentBtnMobile.addEventListener('click', function () {
            openFormModal();
        });
    }

    // Tombol hamburger — mobile
    var hamburgerBtn   = document.getElementById('hamburgerBtn');
    var adminSidebar   = document.getElementById('adminSidebar');
    var sidebarOverlay = document.getElementById('sidebarOverlay');

    function openSidebar() {
        if (adminSidebar)   adminSidebar.classList.add('show');
        if (sidebarOverlay) sidebarOverlay.classList.add('show');
        document.body.classList.add('sidebar-open');
    }
    function closeSidebar() {
        if (adminSidebar)   adminSidebar.classList.remove('show');
        if (sidebarOverlay) sidebarOverlay.classList.remove('show');
        document.body.classList.remove('sidebar-open');
    }
    function toggleSidebar() {
        if (adminSidebar && adminSidebar.classList.contains('show')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    if (hamburgerBtn)   hamburgerBtn.addEventListener('click', toggleSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    // Tutup sidebar saat nav-link diklik (mobile)
    document.querySelectorAll('.admin-nav-link').forEach(function (link) {
        link.addEventListener('click', function () {
            if (window.innerWidth < 1024) closeSidebar();
        });
    });

    // Form submit
    var contentForm = document.getElementById('contentForm');
    if (contentForm) contentForm.addEventListener('submit', handleContentSubmit);

    // Tombol tutup modal — gunakan ID spesifik
    var formModalClose = document.getElementById('formModalClose');
    var formCancelBtn  = document.getElementById('formCancelBtn');
    var deleteModalClose = document.getElementById('deleteModalClose');
    var deleteCancelBtn  = document.getElementById('deleteCancelBtn');
    if (formModalClose)  formModalClose.addEventListener('click',  closeAllModals);
    if (formCancelBtn)   formCancelBtn.addEventListener('click',   closeAllModals);
    if (deleteModalClose) deleteModalClose.addEventListener('click', closeAllModals);
    if (deleteCancelBtn)  deleteCancelBtn.addEventListener('click',  closeAllModals);

    // Klik backdrop modal = tutup
    document.querySelectorAll('.modal').forEach(function (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeAllModals();
        });
    });

    // Filter search
    var filterSearch = document.getElementById('filterSearch');
    if (filterSearch) {
        var searchTimeout;
        filterSearch.addEventListener('input', function (e) {
            clearTimeout(searchTimeout);
            var val = e.target.value;
            searchTimeout = setTimeout(function () {
                currentFilter.search = val;
                filterContent();
            }, 300);
        });
    }

    // Filter kategori
    var filterCategory = document.getElementById('filterCategory');
    if (filterCategory) {
        filterCategory.addEventListener('change', function (e) {
            currentFilter.category = e.target.value;
            filterContent();
        });
    }

    // Preview thumbnail
    var thumbInput = document.getElementById('thumbnail_url');
    if (thumbInput) {
        thumbInput.addEventListener('input', function (e) {
            updateThumbnailPreview(e.target.value);
        });
    }

    // Tags input
    setupTagsInput();
}

// ── Auth ──────────────────────────────────────────────────────
async function checkAuth() {
    try {
        var res     = await supabaseClient.auth.getSession();
        var session = res.data.session;
        if (session) {
            currentUser = session.user;
            showAdminPanel();
            await loadAdminData();
        } else {
            showLoginPanel();
        }
    } catch (err) {
        console.error('checkAuth error:', err);
        showLoginPanel();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    var email    = document.getElementById('email').value;
    var password = document.getElementById('password').value;
    var loginForm = document.getElementById('loginForm');
    var btn  = loginForm.querySelector('button[type="submit"]');
    var orig = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

    try {
        var res = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
        if (res.error) throw res.error;
        currentUser = res.data.user;
        window.showToast('Login berhasil!', 'success');
        showAdminPanel();
        await loadAdminData();
    } catch (err) {
        console.error('Login error:', err);
        window.showToast('Email atau password salah', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
        currentUser = null;
        window.showToast('Logout berhasil', 'success');
        showLoginPanel();
    } catch (err) {
        console.error('Logout error:', err);
        window.showToast('Gagal logout', 'error');
    }
}

// ── Panel Visibility ──────────────────────────────────────────
function showLoginPanel() {
    var loginSection = document.getElementById('loginSection');
    var adminSection = document.getElementById('adminSection');
    if (loginSection) loginSection.classList.remove('hidden');
    if (adminSection) adminSection.classList.add('hidden');
}

function showAdminPanel() {
    var loginSection = document.getElementById('loginSection');
    var adminSection = document.getElementById('adminSection');
    if (loginSection) loginSection.classList.add('hidden');
    if (adminSection) adminSection.classList.remove('hidden');

    if (currentUser) {
        var nameEl   = document.getElementById('userName');
        var emailEl  = document.getElementById('userEmail');
        var avatarEl = document.getElementById('userAvatar');
        var meta     = currentUser.user_metadata || {};
        if (nameEl)   nameEl.textContent   = meta.full_name || (currentUser.email || '').split('@')[0] || 'Admin';
        if (emailEl)  emailEl.textContent  = currentUser.email || '';
        if (avatarEl) avatarEl.textContent = ((currentUser.email || 'A')[0]).toUpperCase();
    }
}

// ── Load Data ─────────────────────────────────────────────────
async function loadAdminData() {
    showLoading(true);
    await loadContentList();
    renderStatistics();
    showLoading(false);
}

async function loadContentList() {
    var res = await window.contentDB.getAllContent();
    if (res.error) { window.showToast('Gagal memuat konten', 'error'); return; }
    contentList = res.data || [];
    renderContentTable(contentList);
}

// ── Render Table ──────────────────────────────────────────────
function renderContentTable(list) {
    var tbody = document.getElementById('contentTable');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-table"><i class="fas fa-inbox"></i><p>Belum ada konten</p></td></tr>';
        return;
    }

    tbody.innerHTML = list.map(function (item) {
        var color = (typeof CATEGORY_COLORS !== 'undefined' && CATEGORY_COLORS[item.category]) || '#4A90E2';
        var thumb = (typeof DEFAULT_THUMBNAIL !== 'undefined') ? DEFAULT_THUMBNAIL : '';
        var src   = item.thumbnail_url || thumb;
        var date  = new Date(item.created_at).toLocaleDateString('id-ID');

        return '<tr>' +
            '<td><img src="' + src + '" class="table-thumb" alt="" onerror="this.src=\'' + thumb + '\'"></td>' +
            '<td class="td-title">' + (item.title || '-') + '</td>' +
            '<td><span class="cat-pill" style="background:' + color + '">' + (item.category || '-') + '</span></td>' +
            '<td>' + (item.year || '-') + '</td>' +
            '<td><span class="likes-badge"><i class="fas fa-heart"></i> ' + (item.likes || 0) + '</span></td>' +
            '<td>' + date + '</td>' +
            '<td><div class="table-actions">' +
                '<button class="table-btn table-btn-view"   onclick="viewContent(\'' + item.id + '\')"   title="Lihat"><i class="fas fa-eye"></i></button>' +
                '<button class="table-btn table-btn-edit"   onclick="editContent(\'' + item.id + '\')"   title="Edit"><i class="fas fa-edit"></i></button>' +
                '<button class="table-btn table-btn-delete" onclick="confirmDelete(\'' + item.id + '\')" title="Hapus"><i class="fas fa-trash"></i></button>' +
            '</div></td>' +
        '</tr>';
    }).join('');
}

function filterContent() {
    var q = (currentFilter.search || '').toLowerCase();
    var cat = currentFilter.category;

    var filtered = contentList.filter(function (item) {
        var matchSearch = !q || item.title.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q);
        var matchCat    = !cat || cat === 'Semua' || item.category === cat;
        return matchSearch && matchCat;
    });
    renderContentTable(filtered);
}

// ── Statistics ────────────────────────────────────────────────
function renderStatistics() {
    var container = document.getElementById('statsContainer');
    if (!container) return;

    var total     = contentList.length;
    var totalLikes = contentList.reduce(function (s, c) { return s + (c.likes || 0); }, 0);
    var cards = [
        { icon: 'newspaper',  value: total,     label: 'Total Konten', grad: '#4a90e2,#6c5ce7' },
        { icon: 'film',       value: contentList.filter(function(c){return c.category==='Film';}).length,      label: 'Film',      grad: '#FF6B6B,#ee5a24' },
        { icon: 'microchip',  value: contentList.filter(function(c){return c.category==='Teknologi';}).length, label: 'Teknologi', grad: '#4ECDC4,#44bd9c' },
        { icon: 'coins',      value: contentList.filter(function(c){return c.category==='Keuangan';}).length,  label: 'Keuangan',  grad: '#45B7D1,#2980b9' },
        { icon: 'heartbeat',  value: contentList.filter(function(c){return c.category==='Kesehatan';}).length, label: 'Kesehatan', grad: '#96CEB4,#27ae60' },
        { icon: 'heart',      value: totalLikes, label: 'Total Likes', grad: '#e84393,#c0392b' },
    ];

    container.innerHTML = cards.map(function (c, i) {
        return '<div class="stat-card" style="--i:' + i + '">' +
            '<div class="stat-icon" style="background:linear-gradient(135deg,' + c.grad + ')"><i class="fas fa-' + c.icon + '"></i></div>' +
            '<div class="stat-value">' + c.value + '</div>' +
            '<div class="stat-label">' + c.label + '</div>' +
        '</div>';
    }).join('');
}

// ── Form Modal ────────────────────────────────────────────────
function openFormModal(content) {
    var modal = document.getElementById('formModal');
    var modalTitle = document.getElementById('modalTitle');
    if (!modal) return;

    if (content) {
        if (modalTitle) modalTitle.textContent = 'Edit Konten';
        fillForm(content);
    } else {
        if (modalTitle) modalTitle.textContent = 'Tambah Konten Baru';
        resetForm();
    }
    modal.classList.add('show');
    setTimeout(function () {
        var titleField = document.getElementById('title');
        if (titleField) titleField.focus();
    }, 150);
}

function fillForm(content) {
    var fieldMap = {
        'contentId'      : 'id',
        'category'       : 'category',
        'title'          : 'title',
        'year'           : 'year',
        'duration'       : 'duration',
        'rating'         : 'rating',
        'thumbnail_url'  : 'thumbnail_url',
        'youtube_id'     : 'youtube_id',
        'video_url'      : 'video_url',
        'affiliate_url'  : 'affiliate_url',
        'affiliate_label': 'affiliate_label',
        'affiliate_desc' : 'affiliate_desc',
        'affiliate_badge': 'affiliate_badge',
    };
    Object.keys(fieldMap).forEach(function (elId) {
        var el = document.getElementById(elId);
        if (el) el.value = content[fieldMap[elId]] || '';
    });

    // RTE
    var editor = document.getElementById('rteEditor');
    var hidden  = document.getElementById('description');
    if (editor) { editor.innerHTML = content.description || ''; rteUpdateCharCount(); }
    if (hidden)  hidden.value = content.description || '';

    // Tags
    var tagsEl = document.getElementById('tags');
    var tags   = Array.isArray(content.tags) ? content.tags : [];
    if (tagsEl) { tagsEl.dataset.tags = JSON.stringify(tags); renderTags(tags); }

    updateThumbnailPreview(content.thumbnail_url);
}

function resetForm() {
    var contentId = document.getElementById('contentId');
    var form      = document.getElementById('contentForm');
    if (contentId) contentId.value = '';
    if (form)      form.reset();

    // RTE
    var editor = document.getElementById('rteEditor');
    var hidden  = document.getElementById('description');
    if (editor) { editor.innerHTML = ''; rteUpdateCharCount(); }
    if (hidden)  hidden.value = '';

    // Tags
    var tagsEl = document.getElementById('tags');
    if (tagsEl) { tagsEl.dataset.tags = '[]'; renderTags([]); }

    updateThumbnailPreview('');
}

async function handleContentSubmit(e) {
    e.preventDefault();
    rteSync(); // pastikan hidden field ter-update

    var id         = (document.getElementById('contentId') || {}).value;
    var submitBtn  = e.target.querySelector('button[type="submit"]');
    var origLabel  = submitBtn.innerHTML;

    var formData = {
        category       : (document.getElementById('category')        || {}).value || '',
        title          : (document.getElementById('title')           || {}).value || '',
        year           : parseInt((document.getElementById('year')   || {}).value) || null,
        duration       : (document.getElementById('duration')        || {}).value || '',
        rating         : parseFloat((document.getElementById('rating') || {}).value) || null,
        thumbnail_url  : (document.getElementById('thumbnail_url')   || {}).value || '',
        youtube_id     : (document.getElementById('youtube_id')      || {}).value || '',
        video_url      : (document.getElementById('video_url')       || {}).value || '',
        description    : (document.getElementById('description')     || {}).value || '',
        tags           : JSON.parse((document.getElementById('tags') || {dataset:{tags:'[]'}}).dataset.tags || '[]'),
        affiliate_url  : (document.getElementById('affiliate_url')   || {}).value || '',
        affiliate_label: (document.getElementById('affiliate_label') || {}).value || '',
        affiliate_desc : (document.getElementById('affiliate_desc')  || {}).value || '',
        affiliate_badge: (document.getElementById('affiliate_badge') || {}).value || '',
    };

    if (!formData.title || !formData.category) {
        window.showToast('Judul dan kategori harus diisi', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

    try {
        var res = id
            ? await window.contentDB.updateContent(id, formData)
            : await window.contentDB.createContent(formData);

        if (res.error) throw res.error;
        window.showToast(id ? 'Konten berhasil diupdate ✅' : 'Konten berhasil ditambahkan ✅', 'success');
        closeAllModals();
        await loadAdminData();
    } catch (err) {
        console.error('Save error:', err);
        window.showToast('Gagal menyimpan: ' + (err.message || ''), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origLabel;
    }
}

// ── CRUD Actions ──────────────────────────────────────────────
function viewContent(id)  { window.open('detail.html?id=' + id, '_blank'); }

function editContent(id) {
    var item = contentList.find(function (c) { return String(c.id) === String(id); });
    if (item) openFormModal(item);
    else window.showToast('Konten tidak ditemukan', 'error');
}

function confirmDelete(id) {
    var modal      = document.getElementById('deleteModal');
    var confirmBtn = document.getElementById('confirmDelete');
    if (!modal) return;
    modal.classList.add('show');
    // Lepas handler lama agar tidak menumpuk
    var newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', async function () {
        await deleteContent(id);
        closeAllModals();
    });
}

async function deleteContent(id) {
    try {
        var res = await window.contentDB.deleteContent(id);
        if (res.error) throw res.error;
        window.showToast('Konten berhasil dihapus', 'success');
        await loadAdminData();
    } catch (err) {
        console.error('Delete error:', err);
        window.showToast('Gagal menghapus konten', 'error');
    }
}

// ── Tags ──────────────────────────────────────────────────────
function setupTagsInput() {
    var input = document.getElementById('tags');
    if (!input) return;
    if (!input.dataset.tags) input.dataset.tags = '[]';

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            var tag = input.value.trim().replace(/,/g, '');
            if (tag) { addTag(tag); input.value = ''; }
        }
    });
    input.addEventListener('blur', function () {
        var tag = input.value.trim().replace(/,/g, '');
        if (tag) { addTag(tag); input.value = ''; }
    });
}

function addTag(tag) {
    var input = document.getElementById('tags');
    if (!input) return;
    var tags = JSON.parse(input.dataset.tags || '[]');
    if (tag && !tags.includes(tag)) {
        tags.push(tag);
        input.dataset.tags = JSON.stringify(tags);
        renderTags(tags);
    }
}

function removeTag(tag) {
    var input = document.getElementById('tags');
    if (!input) return;
    var tags  = JSON.parse(input.dataset.tags || '[]');
    var idx   = tags.indexOf(tag);
    if (idx > -1) {
        tags.splice(idx, 1);
        input.dataset.tags = JSON.stringify(tags);
        renderTags(tags);
    }
}

function renderTags(tags) {
    var container = document.querySelector('.tags-input-container');
    var input     = document.getElementById('tags');
    if (!container || !input) return;
    Array.from(container.children).forEach(function (child) {
        if (child !== input) child.remove();
    });
    tags.forEach(function (tag) {
        var el = document.createElement('span');
        el.className = 'tag-item';
        el.innerHTML = tag + '<i class="fas fa-times" onclick="removeTag(\'' + tag.replace(/'/g, "\\'") + '\')"></i>';
        container.insertBefore(el, input);
    });
}

// ── Thumbnail Preview ─────────────────────────────────────────
function updateThumbnailPreview(url) {
    var preview = document.getElementById('thumbnailPreview');
    var img     = document.getElementById('previewImage');
    if (url && preview && img) { img.src = url; preview.classList.remove('hidden'); }
    else if (preview)           { preview.classList.add('hidden'); }
}

// ── Modals & Loading ──────────────────────────────────────────
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(function (m) { m.classList.remove('show'); });
}

function showLoading(show) {
    var overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.toggle('show', show);
}

// ── EXPOSE KE GLOBAL — wajib untuk onclick di HTML ────────────
window.openFormModal  = openFormModal;   // ← FIX: sebelumnya tidak ada!
window.viewContent    = viewContent;
window.editContent    = editContent;
window.confirmDelete  = confirmDelete;
window.addTag         = addTag;
window.removeTag      = removeTag;
window.closeAllModals = closeAllModals;

// ============================================================
// RICH TEXT EDITOR (RTE)
// ============================================================

function rteInit() {
    var editor  = document.getElementById('rteEditor');
    var toolbar = document.getElementById('rteToolbar');
    var linkBtn = document.getElementById('rteLinkBtn');
    if (!editor || !toolbar) return;

    // Tombol toolbar
    toolbar.querySelectorAll('.rte-btn[data-cmd]').forEach(function (btn) {
        btn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            var cmd = btn.dataset.cmd;
            var val = btn.dataset.val || null;
            if (cmd === 'formatBlock' && val === 'BLOCKQUOTE') {
                var sel = window.getSelection();
                var bq  = sel && sel.focusNode && sel.focusNode.parentElement && sel.focusNode.parentElement.closest('blockquote');
                document.execCommand('formatBlock', false, bq ? 'P' : 'BLOCKQUOTE');
            } else {
                document.execCommand(cmd, false, val);
            }
            rteSync();
            rteUpdateActiveStates();
        });
    });

    // Link button
    if (linkBtn) {
        linkBtn.addEventListener('mousedown', function (e) {
            e.preventDefault();
            var sel    = window.getSelection();
            var selTxt = sel ? sel.toString() : '';
            var anchor = sel && sel.focusNode && sel.focusNode.parentElement && sel.focusNode.parentElement.closest('a');
            if (anchor) {
                rteShowLinkPopup(anchor.href, anchor);
            } else if (selTxt) {
                rteShowLinkPopup('https://', null);
            } else {
                window.showToast('Pilih teks dulu sebelum menyisipkan link', 'warning');
            }
        });
    }

    // Sync on input
    editor.addEventListener('input', function () {
        rteSync();
        rteUpdateCharCount();
        rteUpdateActiveStates();
    });

    // Keyboard shortcut
    editor.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey) {
            var k = e.key.toLowerCase();
            if (k === 'b') { e.preventDefault(); document.execCommand('bold');      rteSync(); }
            if (k === 'i') { e.preventDefault(); document.execCommand('italic');    rteSync(); }
            if (k === 'u') { e.preventDefault(); document.execCommand('underline'); rteSync(); }
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
        }
    });

    // Update active states saat seleksi berubah
    document.addEventListener('selectionchange', function () {
        if (document.activeElement === editor) rteUpdateActiveStates();
    });

    // Smart paste
    editor.addEventListener('paste', function (e) {
        e.preventDefault();
        var html  = e.clipboardData.getData('text/html');
        var plain = e.clipboardData.getData('text/plain');
        document.execCommand('insertHTML', false, html ? rteSanitize(html) : plain.replace(/\n/g, '<br>'));
        rteSync();
        rteUpdateCharCount();
    });

    rteUpdateCharCount();
}

function rteSync() {
    var editor = document.getElementById('rteEditor');
    var hidden  = document.getElementById('description');
    if (editor && hidden) hidden.value = editor.innerHTML;
}

function rteUpdateCharCount() {
    var editor  = document.getElementById('rteEditor');
    var countEl = document.getElementById('rteCharCount');
    if (!editor || !countEl) return;
    var count = (editor.innerText || '').replace(/\n/g, '').length;
    countEl.textContent = count.toLocaleString('id') + ' karakter';
}

function rteUpdateActiveStates() {
    var toolbar = document.getElementById('rteToolbar');
    if (!toolbar) return;
    ['bold','italic','underline','strikeThrough',
     'justifyLeft','justifyCenter','justifyRight',
     'insertUnorderedList','insertOrderedList'].forEach(function (cmd) {
        var btn = toolbar.querySelector('[data-cmd="' + cmd + '"]');
        if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
    });
    var block = (document.queryCommandValue('formatBlock') || '').toUpperCase();
    toolbar.querySelectorAll('[data-cmd="formatBlock"]').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.val === block);
    });
}

function rteShowLinkPopup(defaultUrl, existingAnchor) {
    var old = document.getElementById('rteLinkPopup');
    if (old) old.remove();

    var sel   = window.getSelection();
    var range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;

    var popup = document.createElement('div');
    popup.id = 'rteLinkPopup';
    popup.className = 'rte-link-popup';
    popup.innerHTML =
        '<div class="rte-link-popup-inner">' +
            '<label class="rte-link-label">URL Link</label>' +
            '<input type="url" class="rte-link-input" id="rteLinkInput" value="' + (defaultUrl || '') + '" placeholder="https://...">' +
            '<div class="rte-link-actions">' +
                '<button type="button" class="btn btn-primary btn-sm" id="rteLinkInsert"><i class="fas fa-check"></i> Sisipkan</button>' +
                (existingAnchor ? '<button type="button" class="btn btn-danger btn-sm" id="rteLinkRemove"><i class="fas fa-unlink"></i> Hapus</button>' : '') +
                '<button type="button" class="btn btn-outline btn-sm" id="rteLinkCancel">Batal</button>' +
            '</div>' +
        '</div>';

    var wrapper = document.querySelector('.rte-wrapper');
    if (wrapper) wrapper.appendChild(popup);
    requestAnimationFrame(function () { popup.classList.add('show'); });

    var input = document.getElementById('rteLinkInput');
    if (input) { input.focus(); input.select(); }

    document.getElementById('rteLinkInsert').onclick = function () {
        var url = input ? input.value.trim() : '';
        if (!url || url === 'https://') { window.showToast('Masukkan URL yang valid', 'warning'); return; }
        if (existingAnchor) {
            existingAnchor.href = url;
        } else if (range) {
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('createLink', false, url);
            var link = document.querySelector('a[href="' + url + '"]');
            if (link) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
        }
        rteSync();
        popup.remove();
    };

    var removeBtn = document.getElementById('rteLinkRemove');
    if (removeBtn) {
        removeBtn.onclick = function () {
            if (existingAnchor) {
                var parent = existingAnchor.parentNode;
                while (existingAnchor.firstChild) parent.insertBefore(existingAnchor.firstChild, existingAnchor);
                parent.removeChild(existingAnchor);
            }
            rteSync();
            popup.remove();
        };
    }

    document.getElementById('rteLinkCancel').onclick = function () { popup.remove(); };

    setTimeout(function () {
        document.addEventListener('mousedown', function close(e) {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('mousedown', close);
            }
        });
    }, 100);
}

function rteSanitize(html) {
    var allowed = ['b','strong','i','em','u','s','strike','h2','h3','p','br','ul','ol','li','blockquote','a','span'];
    var div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('*').forEach(function (el) {
        if (!allowed.includes(el.tagName.toLowerCase())) {
            var frag = document.createDocumentFragment();
            while (el.firstChild) frag.appendChild(el.firstChild);
            if (el.parentNode) el.parentNode.replaceChild(frag, el);
        } else {
            Array.from(el.attributes).forEach(function (attr) {
                if (!(el.tagName === 'A' && ['href','target','rel'].includes(attr.name))) {
                    el.removeAttribute(attr.name);
                }
            });
        }
    });
    return div.innerHTML;
}
