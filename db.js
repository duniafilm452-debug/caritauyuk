// ============================================================
//  js/db.js — Semua interaksi dengan Supabase
// ============================================================

/**
 * Ambil semua konten, bisa difilter kategori & pencarian
 */
async function fetchContent(category = 'semua', query = '') {
  let req = supabaseClient
    .from(TABLE_CONTENT)
    .select('*')
    .order('created_at', { ascending: false });

  if (category !== 'semua') {
    req = req.eq('category', category);
  }

  if (query.trim()) {
    req = req.or(
      `title.ilike.%${query}%,description.ilike.%${query}%`
    );
  }

  const { data, error } = await req;
  if (error) { console.error('fetchContent error:', error); return []; }
  return data;
}

/**
 * Toggle like — simpan per session_id di localStorage
 * @returns {{ liked: boolean, newCount: number }}
 */
async function toggleLike(contentId) {
  const sessionId = getSessionId();

  const { data: existing } = await supabaseClient
    .from(TABLE_LIKES)
    .select('id')
    .eq('content_id', contentId)
    .eq('session_id', sessionId)
    .maybeSingle();

  let liked;
  if (existing) {
    await supabaseClient.from(TABLE_LIKES).delete()
      .eq('content_id', contentId)
      .eq('session_id', sessionId);
    await supabaseClient.rpc('decrement_likes', { row_id: contentId });
    liked = false;
  } else {
    await supabaseClient.from(TABLE_LIKES).insert({ content_id: contentId, session_id: sessionId });
    await supabaseClient.rpc('increment_likes', { row_id: contentId });
    liked = true;
  }

  const { data: updated } = await supabaseClient
    .from(TABLE_CONTENT)
    .select('likes')
    .eq('id', contentId)
    .single();

  return { liked, newCount: updated?.likes ?? 0 };
}

/**
 * Cek konten mana saja yang sudah di-like oleh session ini
 * @returns {Set<number>}
 */
async function fetchMyLikes(contentIds) {
  if (!contentIds.length) return new Set();
  const sessionId = getSessionId();
  const { data } = await supabaseClient
    .from(TABLE_LIKES)
    .select('content_id')
    .eq('session_id', sessionId)
    .in('content_id', contentIds);

  return new Set((data || []).map(r => r.content_id));
}

/**
 * Buat atau kembalikan session ID unik pengguna
 */
function getSessionId() {
  let id = localStorage.getItem('cty_session');
  if (!id) {
    id = 'cty_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('cty_session', id);
  }
  return id;
}
