// Database operations untuk content

// Cek apakah sudah dideklarasikan
if (typeof window.ContentDB === 'undefined') {
    class ContentDB {
        constructor(supabaseClient) {
            this.supabase = supabaseClient;
        }

        // Mendapatkan semua konten
        async getAllContent() {
            try {
                const { data, error } = await this.supabase
                    .from('content')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error fetching content:', error);
                return { data: null, error };
            }
        }

        // Mendapatkan konten berdasarkan ID
        async getContentById(id) {
            try {
                const { data, error } = await this.supabase
                    .from('content')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error fetching content by ID:', error);
                return { data: null, error };
            }
        }

        // Mendapatkan konten berdasarkan kategori
        async getContentByCategory(category) {
            try {
                const { data, error } = await this.supabase
                    .from('content')
                    .select('*')
                    .eq('category', category)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error fetching content by category:', error);
                return { data: null, error };
            }
        }

        // Mendapatkan konten terkait (berdasarkan kategori, exclude ID tertentu)
        async getRelatedContent(category, excludeId, limit = 5) {
            try {
                const { data, error } = await this.supabase
                    .from('content')
                    .select('*')
                    .eq('category', category)
                    .neq('id', excludeId)
                    .order('likes', { ascending: false })
                    .limit(limit);

                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error fetching related content:', error);
                return { data: null, error };
            }
        }

        // Menambah konten baru (admin only)
        async createContent(contentData) {
            try {
                // Cek session
                const { data: { session } } = await this.supabase.auth.getSession();
                if (!session) {
                    throw new Error('Anda harus login sebagai admin');
                }

                const { data, error } = await this.supabase
                    .from('content')
                    .insert([{
                        ...contentData,
                        created_at: new Date(),
                        updated_at: new Date()
                    }])
                    .select();

                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error creating content:', error);
                return { data: null, error };
            }
        }

        // Update konten (admin only)
        async updateContent(id, contentData) {
            try {
                // Cek session
                const { data: { session } } = await this.supabase.auth.getSession();
                if (!session) {
                    throw new Error('Anda harus login sebagai admin');
                }

                const { data, error } = await this.supabase
                    .from('content')
                    .update({
                        ...contentData,
                        updated_at: new Date()
                    })
                    .eq('id', id)
                    .select();

                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error updating content:', error);
                return { data: null, error };
            }
        }

        // Hapus konten (admin only)
        async deleteContent(id) {
            try {
                // Cek session
                const { data: { session } } = await this.supabase.auth.getSession();
                if (!session) {
                    throw new Error('Anda harus login sebagai admin');
                }

                const { error } = await this.supabase
                    .from('content')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                return { error: null };
            } catch (error) {
                console.error('Error deleting content:', error);
                return { error };
            }
        }

        // Like content
        async likeContent(contentId, sessionId) {
            try {
                // Cek apakah sudah like
                const { data: existingLike } = await this.supabase
                    .from('content_likes')
                    .select('*')
                    .eq('content_id', contentId)
                    .eq('session_id', sessionId)
                    .single();

                if (existingLike) {
                    // Unlike
                    const { error: deleteError } = await this.supabase
                        .from('content_likes')
                        .delete()
                        .eq('content_id', contentId)
                        .eq('session_id', sessionId);

                    if (deleteError) throw deleteError;

                    // Decrement likes count
                    const { error: rpcError } = await this.supabase
                        .rpc('decrement_likes', { content_id: contentId });

                    if (rpcError) throw rpcError;

                    return { liked: false, error: null };
                } else {
                    // Like
                    const { error: insertError } = await this.supabase
                        .from('content_likes')
                        .insert([{
                            content_id: contentId,
                            session_id: sessionId
                        }]);

                    if (insertError) throw insertError;

                    // Increment likes count
                    const { error: rpcError } = await this.supabase
                        .rpc('increment_likes', { content_id: contentId });

                    if (rpcError) throw rpcError;

                    return { liked: true, error: null };
                }
            } catch (error) {
                console.error('Error toggling like:', error);
                return { liked: false, error };
            }
        }

        // Cek status like
        async checkLikeStatus(contentId, sessionId) {
            try {
                const { data, error } = await this.supabase
                    .from('content_likes')
                    .select('*')
                    .eq('content_id', contentId)
                    .eq('session_id', sessionId)
                    .single();

                if (error && error.code !== 'PGRST116') throw error;
                return { liked: !!data, error: null };
            } catch (error) {
                console.error('Error checking like status:', error);
                return { liked: false, error };
            }
        }

        // Search content
        async searchContent(query) {
            try {
                const { data, error } = await this.supabase
                    .from('content')
                    .select('*')
                    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error searching content:', error);
                return { data: null, error };
            }
        }

        // Filter by category and search
        async filterContent(category = null, query = '') {
            try {
                let supabaseQuery = this.supabase
                    .from('content')
                    .select('*');

                if (category && category !== 'Semua') {
                    supabaseQuery = supabaseQuery.eq('category', category);
                }

                if (query) {
                    supabaseQuery = supabaseQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
                }

                const { data, error } = await supabaseQuery
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error filtering content:', error);
                return { data: null, error };
            }
        }

        // Get content statistics (admin only)
        async getContentStats() {
            try {
                const { data, error } = await this.supabase
                    .from('content')
                    .select('category, likes');

                if (error) throw error;

                // Hitung statistik per kategori
                const stats = {
                    total: data.length,
                    totalLikes: data.reduce((sum, item) => sum + (item.likes || 0), 0),
                    perCategory: {}
                };

                data.forEach(item => {
                    if (!stats.perCategory[item.category]) {
                        stats.perCategory[item.category] = {
                            total: 0,
                            totalLikes: 0
                        };
                    }
                    stats.perCategory[item.category].total++;
                    stats.perCategory[item.category].totalLikes += item.likes || 0;
                });

                return { data: stats, error: null };
            } catch (error) {
                console.error('Error getting content stats:', error);
                return { data: null, error };
            }
        }
    }

    // Generate atau dapatkan session ID untuk tracking like
    function getSessionId() {
        let sessionId = localStorage.getItem('session_id');
        if (!sessionId) {
            sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('session_id', sessionId);
        }
        return sessionId;
    }

    // Simpan ke window object agar bisa diakses global
    window.ContentDB = ContentDB;
    window.getSessionId = getSessionId;
}

// Inisialisasi instance contentDB (hanya sekali)
if (typeof window.contentDB === 'undefined' && typeof supabaseClient !== 'undefined') {
    window.contentDB = new window.ContentDB(supabaseClient);
}