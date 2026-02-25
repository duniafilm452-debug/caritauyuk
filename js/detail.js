// Detail page logic

// Tunggu hingga DOM dan contentDB siap
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.contentDB === 'undefined') {
        console.error('contentDB tidak ditemukan. Pastikan db.js dimuat dengan benar.');
        return;
    }

    await initializeDetail();
});

// Get content ID from URL
const urlParams = new URLSearchParams(window.location.search);
const contentId = urlParams.get('id');

// DOM Elements
const detailMain = document.querySelector('.detail-main');
const detailSidebar = document.querySelector('.detail-sidebar');
const loadingSpinner = document.getElementById('loadingSpinner');
const backButton = document.querySelector('.back-button');

// Initialize detail page
async function initializeDetail() {
    if (!contentId) {
        window.location.href = '404.html';
        return;
    }

    await loadContentDetail();
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Back button
    if (backButton) {
        backButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.history.back();
        });
    }

    // Share buttons
    setupShareButtons();
}

// Load content detail
async function loadContentDetail() {
    showLoading(true);

    // Get content data
    const { data: content, error } = await window.contentDB.getContentById(contentId);

    if (error || !content) {
        showLoading(false);
        window.location.href = '404.html';
        return;
    }

    // Check like status
    const sessionId = window.getSessionId ? window.getSessionId() : getSessionId();
    const { liked } = await window.contentDB.checkLikeStatus(contentId, sessionId);

    // Get related content
    const { data: relatedContent } = await window.contentDB.getRelatedContent(
        content.category, 
        contentId, 
        5
    );

    // Render main content
    renderMainContent(content, liked);

    // Render sidebar
    renderSidebar(relatedContent || []);

    // Render comments section
    renderComments(content);

    showLoading(false);
}

// Render main content
function renderMainContent(content, liked) {
    if (!detailMain) return;

    const mediaHtml = renderMedia(content);
    const affiliateHtml = renderAffiliateBlock(content);

    detailMain.innerHTML = `
        <div class="media-player">
            ${mediaHtml}
        </div>
        
        <div class="content-info">
            <h1 class="content-title">${content.title}</h1>
            
            <div class="content-meta">
                <span class="meta-item">
                    <i class="fas fa-film"></i> ${content.category}
                </span>
                <span class="meta-item">
                    <i class="far fa-calendar"></i> ${content.year || 'N/A'}
                </span>
                <span class="meta-item">
                    <i class="far fa-clock"></i> ${content.duration || 'N/A'}
                </span>
                <span class="meta-item">
                    <i class="fas fa-star" style="color: gold;"></i> ${content.rating || 'N/A'}
                </span>
            </div>
            
            <div class="content-description">
                ${content.description || 'Tidak ada deskripsi.'}
            </div>
            
            <div class="content-tags">
                ${(content.tags || []).map(tag => 
                    `<span class="tag">#${tag}</span>`
                ).join('')}
            </div>
            
            <div class="content-actions">
                <button class="btn btn-like ${liked ? 'liked' : ''}" 
                        onclick="handleLike('${content.id}', this)">
                    <i class="${liked ? 'fas' : 'far'} fa-heart"></i>
                    <span class="like-count">${content.likes || 0}</span>
                    Suka
                </button>
                
                <button class="btn btn-outline" onclick="shareContent()">
                    <i class="fas fa-share-alt"></i> Bagikan
                </button>
            </div>
            
            ${affiliateHtml}
        </div>
    `;

    // Add share buttons after content
    addShareButtons();
}

// Render media (YouTube/video/image)
function renderMedia(content) {
    if (content.youtube_id) {
        return `
            <iframe 
                src="https://www.youtube.com/embed/${content.youtube_id}" 
                title="${content.title}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
            </iframe>
        `;
    } else if (content.video_url) {
        return `
            <video controls>
                <source src="${content.video_url}" type="video/mp4">
                Browser Anda tidak mendukung tag video.
            </video>
        `;
    } else if (content.thumbnail_url) {
        return `<img src="${content.thumbnail_url}" alt="${content.title}">`;
    } else {
        return `
            <div class="media-placeholder">
                <i class="fas fa-play-circle"></i>
                <h3>${content.title}</h3>
                <p>Klik tombol play untuk menonton</p>
            </div>
        `;
    }
}

// Render affiliate block
function renderAffiliateBlock(content) {
    if (!content.affiliate_url || !content.affiliate_label) {
        return '';
    }

    return `
        <div class="affiliate-block">
            ${content.affiliate_badge ? 
                `<span class="affiliate-badge">${content.affiliate_badge}</span>` : 
                ''}
            <h3 class="affiliate-title">${content.affiliate_label}</h3>
            ${content.affiliate_desc ? 
                `<p class="affiliate-desc">${content.affiliate_desc}</p>` : 
                ''}
            <a href="${content.affiliate_url}" 
               class="affiliate-link" 
               target="_blank" 
               rel="nofollow sponsored">
                ${content.affiliate_label} <i class="fas fa-arrow-right"></i>
            </a>
        </div>
    `;
}

// Render sidebar with related content
function renderSidebar(relatedContent) {
    if (!detailSidebar) return;

    // AdSense slot HTML
    const adHtml = `
        <div class="ad-slot sidebar-widget">
            <!-- Iklan 300x250 -->
            <span>Iklan 300x250</span>
        </div>
    `;

    let relatedHtml = '';
    if (relatedContent.length > 0) {
        relatedHtml = `
            <div class="sidebar-widget">
                <h4 class="sidebar-title">Konten Terkait</h4>
                <ul class="related-list">
                    ${relatedContent.map(item => `
                        <li class="related-item">
                            <img src="${item.thumbnail_url || DEFAULT_THUMBNAIL}" 
                                 alt="${item.title}"
                                 class="related-thumbnail"
                                 onerror="this.src='${DEFAULT_THUMBNAIL}'">
                            <div class="related-info">
                                <a href="detail.html?id=${item.id}" class="related-title">
                                    ${item.title}
                                </a>
                                <div class="related-meta">
                                    <span><i class="fas fa-eye"></i> ${item.likes || 0}</span>
                                    <span><i class="far fa-clock"></i> ${item.duration || 'N/A'}</span>
                                </div>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    detailSidebar.innerHTML = adHtml + relatedHtml + adHtml;
}

// Render comments section (placeholder)
function renderComments(content) {
    const commentsSection = document.querySelector('.comments-section');
    if (!commentsSection) return;

    commentsSection.innerHTML = `
        <h4 class="sidebar-title">Komentar (0)</h4>
        
        <div class="comment-form">
            <textarea class="comment-input" 
                      placeholder="Tulis komentar Anda..." 
                      rows="3"></textarea>
            <button class="btn btn-primary" onclick="postComment()">
                Kirim Komentar
            </button>
        </div>
        
        <ul class="comment-list">
            <li class="comment-item">
                <div class="comment-avatar">A</div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">Admin</span>
                        <span class="comment-date">2 jam lalu</span>
                    </div>
                    <div class="comment-text">
                        Terima kasih telah mengunjungi halaman ini. Silakan tinggalkan komentar Anda!
                    </div>
                </div>
            </li>
        </ul>
    `;
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

// Add share buttons
function addShareButtons() {
    const shareContainer = document.createElement('div');
    shareContainer.className = 'share-buttons';
    shareContainer.innerHTML = `
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}" 
           target="_blank" 
           class="share-btn share-facebook">
            <i class="fab fa-facebook-f"></i>
        </a>
        <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(document.title)}" 
           target="_blank" 
           class="share-btn share-twitter">
            <i class="fab fa-twitter"></i>
        </a>
        <a href="https://wa.me/?text=${encodeURIComponent(document.title + ' ' + window.location.href)}" 
           target="_blank" 
           class="share-btn share-whatsapp">
            <i class="fab fa-whatsapp"></i>
        </a>
        <a href="https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(document.title)}" 
           target="_blank" 
           class="share-btn share-telegram">
            <i class="fab fa-telegram-plane"></i>
        </a>
    `;

    const contentActions = document.querySelector('.content-actions');
    if (contentActions) {
        contentActions.after(shareContainer);
    }
}

// Setup share buttons
function setupShareButtons() {
    window.shareContent = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: document.title,
                    text: document.querySelector('.content-description')?.textContent || '',
                    url: window.location.href
                });
                showToast('Terima kasih telah berbagi!', 'success');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error sharing:', error);
                }
            }
        } else {
            // Fallback: copy link
            copyToClipboard(window.location.href);
        }
    };
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Link disalin ke clipboard!', 'success');
    }).catch(() => {
        showToast('Gagal menyalin link', 'error');
    });
}

// Post comment (placeholder)
function postComment() {
    showToast('Fitur komentar akan segera hadir!', 'info');
}

// Show/hide loading
function showLoading(show) {
    if (loadingSpinner) {
        loadingSpinner.classList.toggle('hidden', !show);
    }
}

// Fallback getSessionId
function getSessionId() {
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
        sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('session_id', sessionId);
    }
    return sessionId;
}

// Make functions globally available
window.handleLike = handleLike;
window.shareContent = shareContent;
window.postComment = postComment;