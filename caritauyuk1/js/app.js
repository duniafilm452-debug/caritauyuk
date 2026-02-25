// Main application logic untuk halaman utama

// Tunggu hingga DOM dan contentDB siap
document.addEventListener('DOMContentLoaded', async () => {
    // Tunggu hingga contentDB terdefinisi
    if (typeof window.contentDB === 'undefined') {
        console.error('contentDB tidak ditemukan. Pastikan db.js dimuat dengan benar.');
        return;
    }

    // Inisialisasi
    await initializeApp();
});

// State management
let currentCategory = 'Semua';
let currentSearchQuery = '';
let allContent = [];
let filteredContent = [];

// DOM Elements
const contentGrid = document.getElementById('contentGrid');
const categoryButtons = document.querySelectorAll('.category-btn');
const searchInput = document.getElementById('searchInput');
const loadingSpinner = document.getElementById('loadingSpinner');
const toastContainer = document.getElementById('toastContainer');

// Initialize app
async function initializeApp() {
    await loadContent();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Category filter
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const category = e.target.dataset.category;
            
            // Update active state
            categoryButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Update current category and filter
            currentCategory = category;
            await filterAndDisplayContent();
        });
    });

    // Search input with debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            currentSearchQuery = e.target.value;
            await filterAndDisplayContent();
        }, 300);
    });
}

// Load all content
async function loadContent() {
    showLoading(true);
    
    const { data, error } = await window.contentDB.getAllContent();
    
    if (error) {
        showToast('Gagal memuat konten', 'error');
        showLoading(false);
        return;
    }
    
    allContent = data || [];
    await filterAndDisplayContent();
}

// Filter and display content based on current category and search
async function filterAndDisplayContent() {
    showLoading(true);
    
    const { data, error } = await window.contentDB.filterContent(
        currentCategory === 'Semua' ? null : currentCategory,
        currentSearchQuery
    );
    
    if (error) {
        showToast('Gagal memfilter konten', 'error');
        showLoading(false);
        return;
    }
    
    filteredContent = data || [];
    await renderContentGrid();
    showLoading(false);
}

// Render content grid
async function renderContentGrid() {
    if (!contentGrid) return;
    
    if (filteredContent.length === 0) {
        contentGrid.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search" style="font-size: 3rem; color: var(--text-light);"></i>
                <h3>Tidak ada konten ditemukan</h3>
                <p>Coba kata kunci atau kategori lain</p>
            </div>
        `;
        return;
    }

    let html = '';
    const sessionId = window.getSessionId ? window.getSessionId() : getSessionId();
    
    for (const content of filteredContent) {
        // Cek status like untuk setiap konten
        const { liked } = await window.contentDB.checkLikeStatus(content.id, sessionId);
        
        html += `
            <div class="card" data-id="${content.id}" data-category="${content.category}">
                <div class="card-thumbnail">
                    <img src="${content.thumbnail_url || DEFAULT_THUMBNAIL}" 
                         alt="${content.title}"
                         loading="lazy"
                         onerror="this.src='${DEFAULT_THUMBNAIL}'">
                </div>
                <div class="card-content">
                    <h3 class="card-title">${content.title}</h3>
                    <div class="card-meta">
                        <span><i class="far fa-calendar"></i> ${content.year || 'N/A'}</span>
                        <span><i class="far fa-clock"></i> ${content.duration || 'N/A'}</span>
                        <span><i class="fas fa-star" style="color: gold;"></i> ${content.rating || 'N/A'}</span>
                    </div>
                    <p class="card-description">${truncateText(content.description, 100)}</p>
                    <div class="card-tags">
                        ${(content.tags || []).slice(0, 3).map(tag => 
                            `<span class="tag">${tag}</span>`
                        ).join('')}
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
            </div>
        `;
    }
    
    contentGrid.innerHTML = html;
}

// Handle like button click
async function handleLike(contentId, buttonElement) {
    try {
        const sessionId = window.getSessionId ? window.getSessionId() : getSessionId();
        const { liked, error } = await window.contentDB.likeContent(contentId, sessionId);
        
        if (error) {
            showToast('Gagal memproses like', 'error');
            return;
        }
        
        // Update UI
        const likeIcon = buttonElement.querySelector('i');
        const likeCount = buttonElement.querySelector('.like-count');
        const currentLikes = parseInt(likeCount.textContent);
        
        if (liked) {
            buttonElement.classList.add('liked');
            likeIcon.classList.remove('far');
            likeIcon.classList.add('fas');
            likeCount.textContent = currentLikes + 1;
            showToast('Konten disukai!', 'success');
        } else {
            buttonElement.classList.remove('liked');
            likeIcon.classList.remove('fas');
            likeIcon.classList.add('far');
            likeCount.textContent = currentLikes - 1;
            showToast('Like dibatalkan', 'info');
        }
    } catch (error) {
        console.error('Error handling like:', error);
        showToast('Terjadi kesalahan', 'error');
    }
}

// Show/hide loading spinner
function showLoading(show) {
    if (loadingSpinner) {
        loadingSpinner.classList.toggle('hidden', !show);
    }
    
    if (contentGrid) {
        contentGrid.classList.toggle('loading', show);
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 3000);
}

// Utility: truncate text
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// Fallback getSessionId jika window.getSessionId tidak tersedia
function getSessionId() {
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
        sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('session_id', sessionId);
    }
    return sessionId;
}

// Make functions available globally
window.handleLike = handleLike;
window.showToast = showToast;