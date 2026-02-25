// ============================================================
// db.js — Database operations (Supabase)
// ============================================================

if (typeof window.ContentDB === 'undefined') {

    class ContentDB {
        constructor(client) {
            this.supabase = client;
        }

        // ── Read ──────────────────────────────────────────────────

        async getAllContent() {
            try {
                const { data, error } = await this.supabase
                    .from('content').select('*')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error fetching content:', error);
                return { data: null, error };
            }
        }

        async getContentById(id) {
            try {
                const { data, error } = await this.supabase
                    .from('content').select('*').eq('id', id).single();
                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error fetching content by ID:', error);
                return { data: null, error };
            }
        }

        async getContentByCategory(category) {
            try {
                const { data, error } = await this.supabase
                    .from('content').select('*').eq('category', category)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error fetching content by category:', error);
                return { data: null, error };
            }
        }

        async getRelatedContent(category, excludeId, limit = 5) {
            try {
                const { data, error } = await this.supabase
                    .from('content').select('*')
                    .eq('category', category).neq('id', excludeId)
                    .order('likes', { ascending: false }).limit(limit);
                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error fetching related content:', error);
                return { data: null, error };
            }
        }

        async filterContent(category = null, query = '') {
            try {
                let q = this.supabase.from('content').select('*');
                if (category && category !== 'Semua') q = q.eq('category', category);
                if (query) q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
                const { data, error } = await q.order('created_at', { ascending: false });
                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error filtering content:', error);
                return { data: null, error };
            }
        }

        async searchContent(query) {
            try {
                const { data, error } = await this.supabase
                    .from('content').select('*')
                    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error searching content:', error);
                return { data: null, error };
            }
        }

        // ── Write (admin only) ────────────────────────────────────

        async createContent(contentData) {
            try {
                const { data: { session } } = await this.supabase.auth.getSession();
                if (!session) throw new Error('Anda harus login sebagai admin');

                const { data, error } = await this.supabase
                    .from('content')
                    .insert([{ ...contentData, created_at: new Date(), updated_at: new Date() }])
                    .select();
                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error creating content:', error);
                return { data: null, error };
            }
        }

        async updateContent(id, contentData) {
            try {
                const { data: { session } } = await this.supabase.auth.getSession();
                if (!session) throw new Error('Anda harus login sebagai admin');

                const { data, error } = await this.supabase
                    .from('content')
                    .update({ ...contentData, updated_at: new Date() })
                    .eq('id', id).select();
                if (error) throw error;
                return { data, error: null };
            } catch (error) {
                console.error('Error updating content:', error);
                return { data: null, error };
            }
        }

        async deleteContent(id) {
            try {
                const { data: { session } } = await this.supabase.auth.getSession();
                if (!session) throw new Error('Anda harus login sebagai admin');

                const { error } = await this.supabase
                    .from('content').delete().eq('id', id);
                if (error) throw error;
                return { error: null };
            } catch (error) {
                console.error('Error deleting content:', error);
                return { error };
            }
        }

        // ── Likes ─────────────────────────────────────────────────

        /** Cek 1 like — dipakai di halaman detail */
        async checkLikeStatus(contentId, sessionId) {
            try {
                const { data, error } = await this.supabase
                    .from('content_likes').select('*')
                    .eq('content_id', contentId).eq('session_id', sessionId).single();
                if (error && error.code !== 'PGRST116') throw error;
                return { liked: !!data, error: null };
            } catch (error) {
                console.error('Error checking like status:', error);
                return { liked: false, error };
            }
        }

        /**
         * FIX: Cek banyak like sekaligus (1 request) — dipakai di halaman index
         * Menggantikan loop N+1 query.
         */
        async checkMultipleLikeStatus(contentIds, sessionId) {
            if (!contentIds || contentIds.length === 0) {
                return { likedIds: new Set(), error: null };
            }
            try {
                const { data, error } = await this.supabase
                    .from('content_likes').select('content_id')
                    .in('content_id', contentIds).eq('session_id', sessionId);
                if (error) throw error;
                const likedIds = new Set((data || []).map(r => r.content_id));
                return { likedIds, error: null };
            } catch (error) {
                console.error('Error checking multiple like status:', error);
                return { likedIds: new Set(), error };
            }
        }

        async likeContent(contentId, sessionId) {
            try {
                const { data: existing } = await this.supabase
                    .from('content_likes').select('*')
                    .eq('content_id', contentId).eq('session_id', sessionId).single();

                if (existing) {
                    const { error: delErr } = await this.supabase
                        .from('content_likes').delete()
                        .eq('content_id', contentId).eq('session_id', sessionId);
                    if (delErr) throw delErr;

                    const { error: rpcErr } = await this.supabase
                        .rpc('decrement_likes', { content_id: contentId });
                    if (rpcErr) throw rpcErr;

                    return { liked: false, error: null };
                } else {
                    const { error: insErr } = await this.supabase
                        .from('content_likes').insert([{ content_id: contentId, session_id: sessionId }]);
                    if (insErr) throw insErr;

                    const { error: rpcErr } = await this.supabase
                        .rpc('increment_likes', { content_id: contentId });
                    if (rpcErr) throw rpcErr;

                    return { liked: true, error: null };
                }
            } catch (error) {
                console.error('Error toggling like:', error);
                return { liked: false, error };
            }
        }

        // ── Statistics ────────────────────────────────────────────

        async getContentStats() {
            try {
                const { data, error } = await this.supabase
                    .from('content').select('category, likes');
                if (error) throw error;

                const stats = {
                    total: data.length,
                    totalLikes: data.reduce((s, i) => s + (i.likes || 0), 0),
                    perCategory: {},
                };

                data.forEach(item => {
                    if (!stats.perCategory[item.category]) {
                        stats.perCategory[item.category] = { total: 0, totalLikes: 0 };
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

    window.ContentDB = ContentDB;
}

// Inisialisasi instance (sekali saja)
if (typeof window.contentDB === 'undefined' && typeof supabaseClient !== 'undefined') {
    window.contentDB = new window.ContentDB(supabaseClient);
}
