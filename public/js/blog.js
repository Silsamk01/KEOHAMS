/**
 * KEOHAMS Blog System - Frontend Module
 * Handles blog posts display, search, filtering, and admin management
 */

const BlogSystem = {
    currentPage: 1,
    currentFilters: {},
    currentCategory: null,
    currentTag: null,
    
    /**
     * Initialize blog system
     */
    async initialize() {
        this.setupEventListeners();
        
        // Check which page we're on
        const blogList = document.getElementById('blogList');
        const blogPost = document.getElementById('blogPost');
        const adminBlogManager = document.getElementById('adminBlogManager');
        
        if (blogList) {
            await this.loadBlogPosts();
            await this.loadSidebar();
        }
        
        if (blogPost) {
            await this.loadSinglePost();
        }
        
        if (adminBlogManager) {
            await this.loadAdminBlog();
        }
    },
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Search functionality
        const searchBtn = document.getElementById('blogSearchBtn');
        const searchInput = document.getElementById('blogSearchInput');
        
        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', () => this.handleSearch());
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }
        
        // Filter buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-filter')) {
                const category = e.target.dataset.category;
                this.filterByCategory(category);
            }
            
            if (e.target.classList.contains('tag-filter')) {
                const tag = e.target.dataset.tag;
                this.filterByTag(tag);
            }
            
            if (e.target.classList.contains('clear-filters')) {
                this.clearFilters();
            }
        });
        
        // Admin blog events
        const createPostBtn = document.getElementById('createPostBtn');
        if (createPostBtn) {
            createPostBtn.addEventListener('click', () => this.showPostModal());
        }
        
        const saveDraftBtn = document.getElementById('saveDraftBtn');
        if (saveDraftBtn) {
            saveDraftBtn.addEventListener('click', () => this.savePost('DRAFT'));
        }
        
        const publishPostBtn = document.getElementById('publishPostBtn');
        if (publishPostBtn) {
            publishPostBtn.addEventListener('click', () => this.savePost('PUBLISHED'));
        }
        
        // Bulk actions
        const bulkActionBtn = document.getElementById('executeBulkAction');
        if (bulkActionBtn) {
            bulkActionBtn.addEventListener('click', () => this.executeBulkAction());
        }
    },
    
    /**
     * Load blog posts with filters
     */
    async loadBlogPosts(page = 1) {
        try {
            const params = new URLSearchParams({
                page: page,
                per_page: 12,
                ...this.currentFilters
            });
            
            if (this.currentCategory) {
                params.append('category', this.currentCategory);
            }
            
            if (this.currentTag) {
                params.append('tag', this.currentTag);
            }
            
            const response = await api.get(`/blog?${params.toString()}`);
            
            if (response.success !== false) {
                this.renderBlogPosts(response.data || response);
                this.currentPage = response.current_page || page;
            } else {
                showNotification('Failed to load blog posts', 'error');
            }
        } catch (error) {
            console.error('Error loading blog posts:', error);
            showNotification('Failed to load blog posts', 'error');
        }
    },
    
    /**
     * Render blog posts
     */
    renderBlogPosts(data) {
        const container = document.getElementById('blogPostsContainer');
        if (!container) return;
        
        const posts = data.data || data;
        
        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div class="no-posts">
                    <i class="fas fa-inbox"></i>
                    <p>No blog posts found</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = posts.map(post => `
            <article class="blog-card">
                <div class="blog-card-image">
                    <img src="${post.cover_image_url || post.cover_image || '/images/default-blog.jpg'}" 
                         alt="${post.title}" 
                         onerror="this.src='/images/default-blog.jpg'">
                    ${post.is_featured ? '<span class="featured-badge">Featured</span>' : ''}
                </div>
                <div class="blog-card-content">
                    <div class="blog-meta">
                        ${post.category ? `<span class="category">${post.category}</span>` : ''}
                        <span class="date">${post.formatted_date || formatDate(post.published_at)}</span>
                        ${post.read_time ? `<span class="read-time"><i class="far fa-clock"></i> ${post.read_time}</span>` : ''}
                    </div>
                    <h2 class="blog-title">
                        <a href="/blog/${post.slug}">${post.title}</a>
                    </h2>
                    <p class="blog-excerpt">${post.excerpt || ''}</p>
                    ${post.tags && post.tags.length > 0 ? `
                        <div class="blog-tags">
                            ${post.tags.map(tag => `
                                <span class="tag" data-tag="${tag.slug}">${tag.name}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="blog-footer">
                        <a href="/blog/${post.slug}" class="read-more">
                            Read More <i class="fas fa-arrow-right"></i>
                        </a>
                        <span class="views"><i class="far fa-eye"></i> ${formatNumber(post.view_count || 0)}</span>
                    </div>
                </div>
            </article>
        `).join('');
        
        // Render pagination
        if (data.last_page > 1) {
            this.renderPagination(data);
        }
    },
    
    /**
     * Load single blog post
     */
    async loadSinglePost() {
        try {
            const slug = window.location.pathname.split('/').pop();
            const response = await api.get(`/blog/${slug}`);
            
            if (response.success !== false) {
                const post = response.data || response;
                this.renderSinglePost(post);
                await this.loadRelatedPosts(post.id);
            } else {
                showNotification('Post not found', 'error');
                window.location.href = '/blog';
            }
        } catch (error) {
            console.error('Error loading blog post:', error);
            showNotification('Failed to load blog post', 'error');
        }
    },
    
    /**
     * Render single blog post
     */
    renderSinglePost(post) {
        const container = document.getElementById('blogPostContent');
        if (!container) return;
        
        container.innerHTML = `
            <article class="blog-post-full">
                ${post.cover_image || post.cover_image_url ? `
                    <div class="post-cover">
                        <img src="${post.cover_image_url || post.cover_image}" alt="${post.title}">
                    </div>
                ` : ''}
                
                <header class="post-header">
                    ${post.category ? `<span class="post-category">${post.category}</span>` : ''}
                    <h1 class="post-title">${post.title}</h1>
                    
                    <div class="post-meta">
                        ${post.author ? `
                            <span class="author">
                                <i class="fas fa-user"></i> ${post.author.name || 'Admin'}
                            </span>
                        ` : ''}
                        <span class="date">
                            <i class="far fa-calendar"></i> ${post.formatted_date || formatDate(post.published_at)}
                        </span>
                        ${post.read_time ? `
                            <span class="read-time">
                                <i class="far fa-clock"></i> ${post.read_time}
                            </span>
                        ` : ''}
                        <span class="views">
                            <i class="far fa-eye"></i> ${formatNumber(post.view_count || 0)} views
                        </span>
                    </div>
                    
                    ${post.tags && post.tags.length > 0 ? `
                        <div class="post-tags">
                            ${post.tags.map(tag => `
                                <a href="/blog/tag/${tag.slug}" class="tag">${tag.name}</a>
                            `).join('')}
                        </div>
                    ` : ''}
                </header>
                
                <div class="post-content">
                    ${post.content}
                </div>
                
                <footer class="post-footer">
                    <div class="share-buttons">
                        <span>Share:</span>
                        <button onclick="BlogSystem.sharePost('facebook', '${post.slug}')" class="share-btn facebook">
                            <i class="fab fa-facebook-f"></i>
                        </button>
                        <button onclick="BlogSystem.sharePost('twitter', '${post.slug}')" class="share-btn twitter">
                            <i class="fab fa-twitter"></i>
                        </button>
                        <button onclick="BlogSystem.sharePost('linkedin', '${post.slug}')" class="share-btn linkedin">
                            <i class="fab fa-linkedin-in"></i>
                        </button>
                        <button onclick="BlogSystem.sharePost('copy', '${post.slug}')" class="share-btn copy">
                            <i class="fas fa-link"></i>
                        </button>
                    </div>
                </footer>
            </article>
        `;
    },
    
    /**
     * Load related posts
     */
    async loadRelatedPosts(postId) {
        try {
            const response = await api.get(`/blog/${postId}/related?limit=3`);
            
            if (response.success !== false && response.data) {
                const posts = response.data;
                const container = document.getElementById('relatedPosts');
                
                if (container && posts.length > 0) {
                    container.innerHTML = `
                        <h3>Related Posts</h3>
                        <div class="related-posts-grid">
                            ${posts.map(post => `
                                <article class="related-post">
                                    <a href="/blog/${post.slug}">
                                        <img src="${post.cover_image_url || '/images/default-blog.jpg'}" 
                                             alt="${post.title}">
                                        <h4>${post.title}</h4>
                                        <span class="date">${post.formatted_date || formatDate(post.published_at)}</span>
                                    </a>
                                </article>
                            `).join('')}
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Error loading related posts:', error);
        }
    },
    
    /**
     * Load sidebar widgets
     */
    async loadSidebar() {
        await this.loadFeaturedPosts();
        await this.loadPopularPosts();
        await this.loadCategories();
        await this.loadTags();
    },
    
    /**
     * Load featured posts
     */
    async loadFeaturedPosts() {
        try {
            const response = await api.get('/blog/featured?limit=5');
            const posts = response.data || response;
            
            const container = document.getElementById('featuredPosts');
            if (!container || !posts || posts.length === 0) return;
            
            container.innerHTML = posts.map(post => `
                <div class="sidebar-post">
                    <a href="/blog/${post.slug}">
                        <h4>${post.title}</h4>
                        <span class="date">${post.formatted_date || formatDate(post.published_at)}</span>
                    </a>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading featured posts:', error);
        }
    },
    
    /**
     * Load popular posts
     */
    async loadPopularPosts() {
        try {
            const response = await api.get('/blog/popular?days=30&limit=5');
            const posts = response.data || response;
            
            const container = document.getElementById('popularPosts');
            if (!container || !posts || posts.length === 0) return;
            
            container.innerHTML = posts.map(post => `
                <div class="sidebar-post">
                    <a href="/blog/${post.slug}">
                        <h4>${post.title}</h4>
                        <div class="post-stats">
                            <span><i class="far fa-eye"></i> ${formatNumber(post.view_count || 0)}</span>
                            <span>${post.formatted_date || formatDate(post.published_at)}</span>
                        </div>
                    </a>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading popular posts:', error);
        }
    },
    
    /**
     * Load categories
     */
    async loadCategories() {
        try {
            const response = await api.get('/blog/categories');
            const categories = response.data || response;
            
            const container = document.getElementById('categoriesList');
            if (!container || !categories || categories.length === 0) return;
            
            container.innerHTML = categories.map(cat => `
                <a href="#" class="category-item category-filter" data-category="${cat.category || cat}">
                    <span>${cat.category || cat}</span>
                    ${cat.post_count ? `<span class="count">(${cat.post_count})</span>` : ''}
                </a>
            `).join('');
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    },
    
    /**
     * Load tags
     */
    async loadTags() {
        try {
            const response = await api.get('/blog/tags');
            const tags = response.data || response;
            
            const container = document.getElementById('tagsList');
            if (!container || !tags || tags.length === 0) return;
            
            container.innerHTML = tags.map(tag => `
                <a href="#" class="tag-item tag-filter" data-tag="${tag.slug}">
                    ${tag.name} ${tag.posts_count ? `(${tag.posts_count})` : ''}
                </a>
            `).join('');
        } catch (error) {
            console.error('Error loading tags:', error);
        }
    },
    
    /**
     * Handle search
     */
    async handleSearch() {
        const searchInput = document.getElementById('blogSearchInput');
        const query = searchInput?.value.trim();
        
        if (!query) {
            showNotification('Please enter a search term', 'warning');
            return;
        }
        
        try {
            const response = await api.get(`/blog/search?q=${encodeURIComponent(query)}`);
            
            if (response.success !== false) {
                this.renderBlogPosts(response.data || response);
                this.currentFilters = { search: query };
            } else {
                showNotification('Search failed', 'error');
            }
        } catch (error) {
            console.error('Error searching:', error);
            showNotification('Search failed', 'error');
        }
    },
    
    /**
     * Filter by category
     */
    async filterByCategory(category) {
        this.currentCategory = category;
        this.currentTag = null;
        this.currentFilters = {};
        await this.loadBlogPosts(1);
    },
    
    /**
     * Filter by tag
     */
    async filterByTag(tag) {
        this.currentTag = tag;
        this.currentCategory = null;
        this.currentFilters = {};
        await this.loadBlogPosts(1);
    },
    
    /**
     * Clear filters
     */
    async clearFilters() {
        this.currentCategory = null;
        this.currentTag = null;
        this.currentFilters = {};
        await this.loadBlogPosts(1);
    },
    
    /**
     * Share post
     */
    sharePost(platform, slug) {
        const url = `${window.location.origin}/blog/${slug}`;
        const title = document.querySelector('.post-title')?.textContent || 'Check out this post';
        
        let shareUrl = '';
        
        switch(platform) {
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
                break;
            case 'linkedin':
                shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
                break;
            case 'copy':
                navigator.clipboard.writeText(url);
                showNotification('Link copied to clipboard!', 'success');
                return;
        }
        
        if (shareUrl) {
            window.open(shareUrl, '_blank', 'width=600,height=400');
        }
    },
    
    /**
     * Render pagination
     */
    renderPagination(data) {
        const container = document.getElementById('blogPagination');
        if (!container) return;
        
        const { current_page, last_page, from, to, total } = data;
        
        let html = `
            <div class="pagination-info">
                Showing ${from} to ${to} of ${total} posts
            </div>
            <div class="pagination-buttons">
        `;
        
        // Previous button
        html += `
            <button class="pagination-btn" 
                    ${current_page === 1 ? 'disabled' : ''} 
                    onclick="BlogSystem.loadBlogPosts(${current_page - 1})">
                <i class="fas fa-chevron-left"></i> Previous
            </button>
        `;
        
        // Page numbers
        for (let i = 1; i <= last_page; i++) {
            if (
                i === 1 || 
                i === last_page || 
                (i >= current_page - 2 && i <= current_page + 2)
            ) {
                html += `
                    <button class="pagination-btn ${i === current_page ? 'active' : ''}" 
                            onclick="BlogSystem.loadBlogPosts(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === current_page - 3 || i === current_page + 3) {
                html += '<span class="pagination-ellipsis">...</span>';
            }
        }
        
        // Next button
        html += `
            <button class="pagination-btn" 
                    ${current_page === last_page ? 'disabled' : ''} 
                    onclick="BlogSystem.loadBlogPosts(${current_page + 1})">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        html += '</div>';
        container.innerHTML = html;
    },
    
    /**
     * ADMIN FUNCTIONS
     */
    
    /**
     * Load admin blog manager
     */
    async loadAdminBlog() {
        await this.loadAdminPosts();
        await this.loadBlogStatistics();
    },
    
    /**
     * Load admin posts
     */
    async loadAdminPosts(filters = {}) {
        try {
            const params = new URLSearchParams({
                page: filters.page || 1,
                per_page: 20,
                ...filters
            });
            
            const response = await api.get(`/admin/blog?${params.toString()}`);
            
            if (response.success !== false) {
                this.renderAdminPosts(response.data || response);
            }
        } catch (error) {
            console.error('Error loading admin posts:', error);
            showNotification('Failed to load posts', 'error');
        }
    },
    
    /**
     * Render admin posts table
     */
    renderAdminPosts(data) {
        const container = document.getElementById('adminPostsTable');
        if (!container) return;
        
        const posts = data.data || data;
        
        if (!posts || posts.length === 0) {
            container.innerHTML = '<tr><td colspan="7">No posts found</td></tr>';
            return;
        }
        
        container.innerHTML = posts.map(post => `
            <tr>
                <td><input type="checkbox" class="post-checkbox" value="${post.id}"></td>
                <td>
                    <strong>${post.title}</strong><br>
                    <small>${post.slug}</small>
                </td>
                <td>${post.category || '-'}</td>
                <td>
                    <span class="badge badge-${post.status === 'PUBLISHED' ? 'success' : 'warning'}">
                        ${post.status}
                    </span>
                    ${post.is_featured ? '<span class="badge badge-info">Featured</span>' : ''}
                </td>
                <td>${formatNumber(post.view_count || 0)}</td>
                <td>${post.published_at ? formatDate(post.published_at) : 'Not published'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="BlogSystem.editPost(${post.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${post.status === 'DRAFT' ? `
                        <button class="btn btn-sm btn-success" onclick="BlogSystem.publishPost(${post.id})">
                            <i class="fas fa-upload"></i>
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-warning" onclick="BlogSystem.unpublishPost(${post.id})">
                            <i class="fas fa-download"></i>
                        </button>
                    `}
                    <button class="btn btn-sm btn-info" onclick="BlogSystem.toggleFeatured(${post.id})">
                        <i class="fas fa-star"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="BlogSystem.deletePost(${post.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },
    
    /**
     * Load blog statistics
     */
    async loadBlogStatistics() {
        try {
            const response = await api.get('/admin/blog/statistics');
            
            if (response.success !== false) {
                const stats = response.data || response;
                this.renderBlogStatistics(stats);
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    },
    
    /**
     * Render blog statistics
     */
    renderBlogStatistics(stats) {
        const container = document.getElementById('blogStatistics');
        if (!container) return;
        
        container.innerHTML = `
            <div class="stat-card">
                <i class="fas fa-file-alt"></i>
                <div class="stat-info">
                    <h3>${stats.total_posts || 0}</h3>
                    <p>Total Posts</p>
                </div>
            </div>
            <div class="stat-card">
                <i class="fas fa-eye"></i>
                <div class="stat-info">
                    <h3>${formatNumber(stats.total_views || 0)}</h3>
                    <p>Total Views</p>
                </div>
            </div>
            <div class="stat-card">
                <i class="fas fa-folder"></i>
                <div class="stat-info">
                    <h3>${stats.total_categories || 0}</h3>
                    <p>Categories</p>
                </div>
            </div>
            <div class="stat-card">
                <i class="fas fa-tags"></i>
                <div class="stat-info">
                    <h3>${stats.total_tags || 0}</h3>
                    <p>Tags</p>
                </div>
            </div>
        `;
    },
    
    /**
     * Show post modal for create/edit
     */
    showPostModal(post = null) {
        const modal = document.getElementById('postModal');
        const form = document.getElementById('postForm');
        
        if (!modal || !form) return;
        
        // Reset or populate form
        if (post) {
            document.getElementById('postId').value = post.id;
            document.getElementById('postTitle').value = post.title;
            document.getElementById('postSlug').value = post.slug;
            document.getElementById('postCategory').value = post.category || '';
            document.getElementById('postExcerpt').value = post.excerpt || '';
            document.getElementById('postContent').value = post.content;
            document.getElementById('postSeoTitle').value = post.seo_title || '';
            document.getElementById('postSeoDescription').value = post.seo_description || '';
            document.getElementById('postIsFeatured').checked = post.is_featured;
            
            // Set tags
            if (post.tags) {
                const tagNames = post.tags.map(t => t.name).join(', ');
                document.getElementById('postTags').value = tagNames;
            }
        } else {
            form.reset();
            document.getElementById('postId').value = '';
        }
        
        modal.style.display = 'block';
    },
    
    /**
     * Save post (create or update)
     */
    async savePost(status = 'DRAFT') {
        try {
            const form = document.getElementById('postForm');
            const formData = new FormData(form);
            const postId = document.getElementById('postId').value;
            
            const data = {
                title: formData.get('title'),
                slug: formData.get('slug'),
                category: formData.get('category'),
                excerpt: formData.get('excerpt'),
                content: formData.get('content'),
                cover_image: formData.get('cover_image'),
                seo_title: formData.get('seo_title'),
                seo_description: formData.get('seo_description'),
                is_featured: formData.get('is_featured') === 'on',
                status: status,
                tags: formData.get('tags') ? formData.get('tags').split(',').map(t => t.trim()) : [],
            };
            
            if (status === 'PUBLISHED' && !postId) {
                data.publish_now = true;
            }
            
            let response;
            if (postId) {
                response = await api.put(`/admin/blog/${postId}`, data);
            } else {
                response = await api.post('/admin/blog', data);
            }
            
            if (response.success !== false) {
                showNotification(`Post ${postId ? 'updated' : 'created'} successfully!`, 'success');
                this.closePostModal();
                await this.loadAdminPosts();
            } else {
                showNotification(response.message || 'Failed to save post', 'error');
            }
        } catch (error) {
            console.error('Error saving post:', error);
            showNotification('Failed to save post', 'error');
        }
    },
    
    /**
     * Close post modal
     */
    closePostModal() {
        const modal = document.getElementById('postModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },
    
    /**
     * Edit post
     */
    async editPost(id) {
        try {
            const response = await api.get(`/admin/blog/${id}`);
            
            if (response.success !== false) {
                const post = response.data || response;
                this.showPostModal(post);
            }
        } catch (error) {
            console.error('Error loading post:', error);
            showNotification('Failed to load post', 'error');
        }
    },
    
    /**
     * Publish post
     */
    async publishPost(id) {
        try {
            const response = await api.post(`/admin/blog/${id}/publish`);
            
            if (response.success !== false) {
                showNotification('Post published successfully!', 'success');
                await this.loadAdminPosts();
            }
        } catch (error) {
            console.error('Error publishing post:', error);
            showNotification('Failed to publish post', 'error');
        }
    },
    
    /**
     * Unpublish post
     */
    async unpublishPost(id) {
        try {
            const response = await api.post(`/admin/blog/${id}/unpublish`);
            
            if (response.success !== false) {
                showNotification('Post unpublished successfully!', 'success');
                await this.loadAdminPosts();
            }
        } catch (error) {
            console.error('Error unpublishing post:', error);
            showNotification('Failed to unpublish post', 'error');
        }
    },
    
    /**
     * Toggle featured status
     */
    async toggleFeatured(id) {
        try {
            const response = await api.post(`/admin/blog/${id}/toggle-featured`);
            
            if (response.success !== false) {
                showNotification('Featured status updated!', 'success');
                await this.loadAdminPosts();
            }
        } catch (error) {
            console.error('Error toggling featured:', error);
            showNotification('Failed to update featured status', 'error');
        }
    },
    
    /**
     * Delete post
     */
    async deletePost(id) {
        if (!confirm('Are you sure you want to delete this post?')) {
            return;
        }
        
        try {
            const response = await api.delete(`/admin/blog/${id}`);
            
            if (response.success !== false) {
                showNotification('Post deleted successfully!', 'success');
                await this.loadAdminPosts();
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            showNotification('Failed to delete post', 'error');
        }
    },
    
    /**
     * Execute bulk action
     */
    async executeBulkAction() {
        const action = document.getElementById('bulkActionSelect')?.value;
        const checkboxes = document.querySelectorAll('.post-checkbox:checked');
        const postIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        if (!action || postIds.length === 0) {
            showNotification('Please select posts and an action', 'warning');
            return;
        }
        
        if (!confirm(`Are you sure you want to ${action} ${postIds.length} post(s)?`)) {
            return;
        }
        
        try {
            const response = await api.post('/admin/blog/bulk-action', {
                action: action,
                post_ids: postIds
            });
            
            if (response.success !== false) {
                showNotification(`Bulk ${action} completed successfully!`, 'success');
                await this.loadAdminPosts();
            }
        } catch (error) {
            console.error('Error executing bulk action:', error);
            showNotification('Bulk action failed', 'error');
        }
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BlogSystem.initialize());
} else {
    BlogSystem.initialize();
}

// Make globally accessible
window.BlogSystem = BlogSystem;
