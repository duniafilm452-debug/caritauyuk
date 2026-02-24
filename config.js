// ============================================================
//  js/config.js — Konfigurasi Supabase
//  Ganti SUPABASE_URL dan SUPABASE_ANON_KEY dengan milik Anda
//  Dapatkan dari: Supabase Dashboard → Settings → API
// ============================================================

const SUPABASE_URL      = 'https://ucguioolhvytinvqnirk.supabase.co'; // ← ganti
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjZ3Vpb29saHZ5dGludnFuaXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjM0MTksImV4cCI6MjA4NzMzOTQxOX0.Y9ETtIB6QMj5D6Wp278TOLGWKFKf04ecpLHzQ3Wq2cg'; // ← ganti

// Inisialisasi Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Nama tabel
const TABLE_CONTENT = 'content';
const TABLE_LIKES   = 'content_likes';
