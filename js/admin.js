// Admin panel logic

// Tunggu hingga DOM dan contentDB siap
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.contentDB === 'undefined') {
        console.error('contentDB tidak ditemukan. Pastikan db.js dimuat dengan benar.');
        return;
    }

    initializeAdmin();
});

let currentUser = null;
let contentList = [];
let currentFilter = {
    search: '',
    category: 'Semua'
};

// DOM Elements
const loginSection = document.getElementById('loginSection');
const adminSection = document.getElementById('adminSection');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const contentTable = document.getElementById('contentTable');
const addContentBtn = document.getElementById('addContentBtn');
const contentForm = document.getElementById('contentForm');
const formModal = document.getElementById('formModal');
const deleteModal = document.getElementById('deleteModal');
const filterSearch = document.getElementById('filterSearch');
const filterCategory = document.getElementById('filterCategory');
const statsContainer = document.getElementById('statsContainer');

// Initialize admin
function initializeAdmin() {
    checkAuth();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Add content button
    if (addContentBtn) {
        addContentBtn.addEventListener('click', () => openFormModal());
    }

    // Content form
    if (contentForm) {
        contentForm.addEventListener('submit', handleContentSubmit);
    }

    // Filter inputs with debounce
    if (filterSearch) {
        let timeout;
        filterSearch.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                currentFilter.search = e.target.value;
                filterContent();
            }, 300);
        });
    }

    if (filterCategory) {
        filterCategory.addEventListener('change', (e) => {
            currentFilter.category = e.target.value;
            filterContent();
        });
    }

    // Thumbnail URL preview
    const thumbnailUrl = document.getElementById('thumbnail_url');
    if (thumbnailUrl) {
        thumbnailUrl.addEventListener('input', (e) => {
            updateThumbnailPreview(e.target.value);
        });
    }

    // Tags input
    setupTagsInput();

    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal .btn-outline').forEach(btn => {
        btn.addEventListener('click', () => closeAllModals());
    });
}

// Check authentication
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
        showToast('Gagal memeriksa autentikasi', 'error');
        showLoginPanel();
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    // Show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        currentUser = data.user;
        showToast('Login berhasil!', 'success');
        showAdminPanel();
        await loadAdminData();
    } catch (error) {
        console.error('Login error:', error);
        showToast('Email atau password salah', 'error');
    } finally {
        // Restore button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Handle logout
async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;

        currentUser = null;
        showToast('Logout berhasil', 'success');
        showLoginPanel();
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Gagal logout', 'error');
    }
}

// Show login panel
function showLoginPanel() {
    if (loginSection) loginSection.classList.remove('hidden');
    if (adminSection) adminSection.classList.add('hidden');
}

// Show admin panel
function showAdminPanel() {
    if (loginSection) loginSection.classList.add('hidden');
    if (adminSection) adminSection.classList.remove('hidden');
    
    // Update user info
    if (currentUser) {
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const userAvatar = document.getElementById('userAvatar');
        
        if (userName) {
            userName.textContent = currentUser.user_metadata?.full_name || 
                                  currentUser.email?.split('@')[0] || 
                                  'Admin';
        }
        if (userEmail) {
            userEmail.textContent = currentUser.email;
        }
        if (userAvatar) {
            const initial = (currentUser.email?.[0] || 'A').toUpperCase();
            userAvatar.textContent = initial;
        }
    }
}

// Load admin data
async function loadAdminData() {
    showLoading(true);
    await Promise.all([
        loadContentList(),
        loadStatistics()
    ]);
    showLoading(false);
}

// Load content list
async function loadContentList() {
    const { data, error } = await window.contentDB.getAllContent();
    
    if (error) {
        showToast('Gagal memuat konten', 'error');
        return;
    }

    contentList = data || [];
    renderContentTable(contentList);
}

// Render content table
function renderContentTable(content) {
    if (!contentTable) return;

    if (content.length === 0) {
        contentTable.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: var(--spacing-xl);">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: var(--text-light); margin-bottom: var(--spacing-md);"></i>
                    <p>Tidak ada konten</p>
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    content.forEach(item => {
        html += `
            <tr>
                <td>
                    <img src="${item.thumbnail_url || DEFAULT_THUMBNAIL}" 
                         alt="${item.title}"
                         style="width: 50px; height: 35px; object-fit: cover; border-radius: var(--border-radius-sm);"
                         onerror="this.src='${DEFAULT_THUMBNAIL}'">
                </td>
                <td>${item.title}</td>
                <td>${item.category}</td>
                <td>${item.year || '-'}</td>
                <td>${item.likes || 0}</td>
                <td>${new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                <td>
                    <div class="table-actions">
                        <button class="table-btn table-btn-view" onclick="viewContent('${item.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="table-btn table-btn-edit" onclick="editContent('${item.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="table-btn table-btn-delete" onclick="confirmDelete('${item.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    contentTable.innerHTML = html;
}

// Filter content
function filterContent() {
    let filtered = [...contentList];

    // Filter by search
    if (currentFilter.search) {
        const searchLower = currentFilter.search.toLowerCase();
        filtered = filtered.filter(item => 
            item.title.toLowerCase().includes(searchLower) ||
            (item.description && item.description.toLowerCase().includes(searchLower))
        );
    }

    // Filter by category
    if (currentFilter.category && currentFilter.category !== 'Semua') {
        filtered = filtered.filter(item => item.category === currentFilter.category);
    }

    renderContentTable(filtered);
}

// Load statistics
async function loadStatistics() {
    const stats = {
        total: contentList.length,
        film: contentList.filter(c => c.category === 'Film').length,
        teknologi: contentList.filter(c => c.category === 'Teknologi').length,
        keuangan: contentList.filter(c => c.category === 'Keuangan').length,
        kesehatan: contentList.filter(c => c.category === 'Kesehatan').length,
        totalLikes: contentList.reduce((sum, c) => sum + (c.likes || 0), 0)
    };

    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-newspaper"></i>
                </div>
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">Total Konten</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-film"></i>
                </div>
                <div class="stat-value">${stats.film}</div>
                <div class="stat-label">Film</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-microchip"></i>
                </div>
                <div class="stat-value">${stats.teknologi}</div>
                <div class="stat-label">Teknologi</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-coins"></i>
                </div>
                <div class="stat-value">${stats.keuangan}</div>
                <div class="stat-label">Keuangan</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-heartbeat"></i>
                </div>
                <div class="stat-value">${stats.kesehatan}</div>
                <div class="stat-label">Kesehatan</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-heart"></i>
                </div>
                <div class="stat-value">${stats.totalLikes}</div>
                <div class="stat-label">Total Likes</div>
            </div>
        `;
    }
}

// Open form modal for add/edit
function openFormModal(content = null) {
    const modal = document.getElementById('formModal');
    const modalTitle = document.getElementById('modalTitle');
    
    if (content) {
        modalTitle.textContent = 'Edit Konten';
        fillForm(content);
    } else {
        modalTitle.textContent = 'Tambah Konten Baru';
        resetForm();
    }
    
    modal.classList.add('show');
}

// Fill form with content data
function fillForm(content) {
    document.getElementById('contentId').value = content.id || '';
    document.getElementById('category').value = content.category || '';
    document.getElementById('title').value = content.title || '';
    document.getElementById('year').value = content.year || '';
    document.getElementById('duration').value = content.duration || '';
    document.getElementById('rating').value = content.rating || '';
    document.getElementById('thumbnail_url').value = content.thumbnail_url || '';
    document.getElementById('youtube_id').value = content.youtube_id || '';
    document.getElementById('video_url').value = content.video_url || '';
    document.getElementById('description').value = content.description || '';
    document.getElementById('affiliate_url').value = content.affiliate_url || '';
    document.getElementById('affiliate_label').value = content.affiliate_label || '';
    document.getElementById('affiliate_desc').value = content.affiliate_desc || '';
    document.getElementById('affiliate_badge').value = content.affiliate_badge || '';

    // Set tags
    const tagsInput = document.getElementById('tags');
    const tagsContainer = document.querySelector('.tags-input-container');
    if (content.tags && Array.isArray(content.tags)) {
        tagsInput.dataset.tags = JSON.stringify(content.tags);
        renderTags(content.tags);
    }

    // Update thumbnail preview
    updateThumbnailPreview(content.thumbnail_url);
}

// Reset form
function resetForm() {
    document.getElementById('contentId').value = '';
    document.getElementById('contentForm').reset();
    document.getElementById('tags').dataset.tags = '[]';
    renderTags([]);
    updateThumbnailPreview('');
}

// Handle content form submit
async function handleContentSubmit(e) {
    e.preventDefault();

    const contentId = document.getElementById('contentId').value;
    const submitBtn = contentForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    // Get form data
    const formData = {
        category: document.getElementById('category').value,
        title: document.getElementById('title').value,
        year: parseInt(document.getElementById('year').value) || null,
        duration: document.getElementById('duration').value,
        rating: parseFloat(document.getElementById('rating').value) || null,
        thumbnail_url: document.getElementById('thumbnail_url').value,
        youtube_id: document.getElementById('youtube_id').value,
        video_url: document.getElementById('video_url').value,
        description: document.getElementById('description').value,
        tags: JSON.parse(document.getElementById('tags').dataset.tags || '[]'),
        affiliate_url: document.getElementById('affiliate_url').value,
        affiliate_label: document.getElementById('affiliate_label').value,
        affiliate_desc: document.getElementById('affiliate_desc').value,
        affiliate_badge: document.getElementById('affiliate_badge').value
    };

    // Validate
    if (!formData.title || !formData.category) {
        showToast('Judul dan kategori harus diisi', 'error');
        return;
    }

    // Show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

    try {
        let result;
        if (contentId) {
            // Update existing
            result = await window.contentDB.updateContent(contentId, formData);
        } else {
            // Create new
            result = await window.contentDB.createContent(formData);
        }

        if (result.error) throw result.error;

        showToast(contentId ? 'Konten berhasil diupdate' : 'Konten berhasil ditambahkan', 'success');
        closeAllModals();
        await loadAdminData();
    } catch (error) {
        console.error('Error saving content:', error);
        showToast('Gagal menyimpan konten', 'error');
    } finally {
        // Restore button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// View content
function viewContent(id) {
    window.open(`detail.html?id=${id}`, '_blank');
}

// Edit content
async function editContent(id) {
    const content = contentList.find(c => c.id === id);
    if (content) {
        openFormModal(content);
    }
}

// Confirm delete
function confirmDelete(id) {
    const modal = document.getElementById('deleteModal');
    const confirmBtn = document.getElementById('confirmDelete');
    
    modal.classList.add('show');
    
    confirmBtn.onclick = async () => {
        await deleteContent(id);
        modal.classList.remove('show');
    };
}

// Delete content
async function deleteContent(id) {
    try {
        const { error } = await window.contentDB.deleteContent(id);
        
        if (error) throw error;
        
        showToast('Konten berhasil dihapus', 'success');
        await loadAdminData();
    } catch (error) {
        console.error('Error deleting content:', error);
        showToast('Gagal menghapus konten', 'error');
    }
}

// Setup tags input
function setupTagsInput() {
    const tagsInput = document.getElementById('tags');
    const tagsContainer = document.querySelector('.tags-input-container');
    
    if (!tagsInput || !tagsContainer) return;

    // Initialize tags array
    if (!tagsInput.dataset.tags) {
        tagsInput.dataset.tags = '[]';
    }

    // Handle key press
    tagsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            
            const tag = tagsInput.value.trim();
            if (tag) {
                addTag(tag);
                tagsInput.value = '';
            }
        }
    });

    // Handle blur
    tagsInput.addEventListener('blur', () => {
        const tag = tagsInput.value.trim();
        if (tag) {
            addTag(tag);
            tagsInput.value = '';
        }
    });
}

// Add tag
function addTag(tag) {
    const tagsInput = document.getElementById('tags');
    const tags = JSON.parse(tagsInput.dataset.tags || '[]');
    
    if (!tags.includes(tag)) {
        tags.push(tag);
        tagsInput.dataset.tags = JSON.stringify(tags);
        renderTags(tags);
    }
}

// Remove tag
function removeTag(tag) {
    const tagsInput = document.getElementById('tags');
    const tags = JSON.parse(tagsInput.dataset.tags || '[]');
    
    const index = tags.indexOf(tag);
    if (index > -1) {
        tags.splice(index, 1);
        tagsInput.dataset.tags = JSON.stringify(tags);
        renderTags(tags);
    }
}

// Render tags
function renderTags(tags) {
    const tagsContainer = document.querySelector('.tags-input-container');
    const tagsInput = document.getElementById('tags');
    
    if (!tagsContainer || !tagsInput) return;

    // Clear container except input
    Array.from(tagsContainer.children).forEach(child => {
        if (child !== tagsInput) {
            child.remove();
        }
    });

    // Add tag elements
    tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag-item';
        tagElement.innerHTML = `
            ${tag}
            <i class="fas fa-times" onclick="removeTag('${tag}')"></i>
        `;
        tagsContainer.insertBefore(tagElement, tagsInput);
    });
}

// Update thumbnail preview
function updateThumbnailPreview(url) {
    const preview = document.getElementById('thumbnailPreview');
    const previewImg = document.getElementById('previewImage');
    
    if (url && preview && previewImg) {
        previewImg.src = url;
        preview.classList.remove('hidden');
    } else if (preview) {
        preview.classList.add('hidden');
    }
}

// Close all modals
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('show');
    });
}

// Show loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }
}

// Make functions globally available
window.viewContent = viewContent;
window.editContent = editContent;
window.confirmDelete = confirmDelete;
window.addTag = addTag;
window.removeTag = removeTag;
window.closeAllModals = closeAllModals;