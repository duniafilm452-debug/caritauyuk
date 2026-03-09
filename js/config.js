// ============================================================
// config.js — Konfigurasi Supabase & Konstanta Global
// ============================================================

const supabaseUrl      = 'https://api.yukcaritau.my.id';
const supabaseAnonKey  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjZ3Vpb29saHZ5dGludnFuaXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjM0MTksImV4cCI6MjA4NzMzOTQxOX0.Y9ETtIB6QMj5D6Wp278TOLGWKFKf04ecpLHzQ3Wq2cg';

// ── Inisialisasi Supabase client ──────────────────────────────
// FIX: Simpan hasil createClient() ke variabel lokal DAN ke window._supabase
// agar bisa ditemukan oleh detail.js melalui getSupabaseClient().
// window.supabase pada titik ini masih berisi LIBRARY object (bukan client),
// sehingga kita tidak boleh menimpa window.supabase.
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// Expose client yang sudah ter-inisialisasi agar bisa diakses oleh
// semua file JS lain (terutama sistem komentar di detail.js)
window._supabase = supabaseClient;

// ── Konstanta Global ──────────────────────────────────────────
const SITE_NAME         = 'Cari tau yuk';
const DEFAULT_THUMBNAIL = 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500';
const CATEGORIES        = ['Film', 'Teknologi', 'Keuangan', 'Kesehatan', 'Lainnya'];
const CATEGORY_COLORS   = {
    'Film'      : '#FF6B6B',
    'Teknologi' : '#4ECDC4',
    'Keuangan'  : '#45B7D1',
    'Kesehatan' : '#96CEB4',
    'Lainnya'   : '#95A5A6',
};
