// ============================================================
// db-public.js — Database operations (READ ONLY + Likes)
// Versi ringan dari db.js untuk halaman publik (index, detail).
// Fungsi admin (create/update/delete/stats) TIDAK dimuat di sini
// agar tidak jadi "unused JS" di halaman publik.
// Untuk halaman admin, tetap gunakan db.js versi lengkap.
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

        // ── Likes ─────────────────────────────────────────────────

        async checkLikeStatus(contentId, sessionId) {
            try {
                const { data, error } = await this.supabase
                    .from('content_likes').select('id')
                    .eq('content_id', contentId)
                    .eq('session_id', sessionId)
                    .maybeSingle();
                if (error) throw error;
                return { liked: !!data, error: null };
            } catch (error) {
                console.error('Error checking like status:', error);
                return { liked: false, error };
            }
        }

        async checkMultipleLikeStatus(contentIds, sessionId) {
            if (!contentIds || contentIds.length === 0) {
                return { likedIds: new Set(), error: null };
            }
            try {
                const { data, error } = await this.supabase
                    .from('content_likes').select('content_id')
                    .in('content_id', contentIds)
                    .eq('session_id', sessionId);
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
                const { data: existing, error: checkErr } = await this.supabase
                    .from('content_likes').select('id')
                    .eq('content_id', contentId)
                    .eq('session_id', sessionId)
                    .maybeSingle();

                if (checkErr) throw checkErr;

                if (existing) {
                    // === UNLIKE ===
                    const { error: delErr } = await this.supabase
                        .from('content_likes').delete()
                        .eq('content_id', contentId)
                        .eq('session_id', sessionId);
                    if (delErr) throw delErr;

                    const { error: rpcErr } = await this.supabase
                        .rpc('decrement_likes', { content_id: contentId });
                    if (rpcErr) throw rpcErr;

                    return { liked: false, error: null };
                } else {
                    // === LIKE ===
                    const { error: insErr } = await this.supabase
                        .from('content_likes')
                        .insert([{ content_id: contentId, session_id: sessionId }]);
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
    }

    window.ContentDB = ContentDB;
}

// Inisialisasi instance (sekali saja)
// FIX: Gunakan window._supabase (bukan const supabaseClient) karena
// variabel const di file lain tidak masuk scope global secara otomatis.
// config.js sudah meng-assign: window._supabase = supabaseClient;
if (typeof window.contentDB === 'undefined' && typeof window._supabase !== 'undefined') {
    window.contentDB = new window.ContentDB(window._supabase);
}
