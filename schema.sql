-- ============================================================
--  CARI TAU YUK! — Supabase Schema
--  Jalankan file ini di Supabase SQL Editor
-- ============================================================

-- Tabel utama konten
CREATE TABLE IF NOT EXISTS content (
  id            BIGSERIAL PRIMARY KEY,
  category      TEXT        NOT NULL CHECK (category IN ('film','sains','teknologi','ai','kesehatan')),
  title         TEXT        NOT NULL,
  year          TEXT,
  duration      TEXT,
  rating        TEXT        DEFAULT '—',
  thumbnail_url TEXT,
  youtube_id    TEXT,                        -- ID video YouTube (opsional)
  video_url     TEXT,                        -- URL video langsung (opsional)
  description   TEXT,
  tags          TEXT[]      DEFAULT '{}',    -- Contoh: ARRAY['Drama','Action']
  likes         INTEGER     DEFAULT 0,

  -- Affiliate
  affiliate_url   TEXT,                      -- Link affiliasi
  affiliate_label TEXT,                      -- Label tombol, misal "Beli Tiket" / "Beli di Shopee"
  affiliate_desc  TEXT,                      -- Keterangan singkat, misal "Tersedia di Bioskop XXI"
  affiliate_badge TEXT,                      -- Badge opsional, misal "Sponsored" / "Partner"

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Update timestamp otomatis
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Tabel likes (opsional: per-user tracking)
CREATE TABLE IF NOT EXISTS content_likes (
  id         BIGSERIAL PRIMARY KEY,
  content_id BIGINT REFERENCES content(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_id, session_id)
);

-- Enable Row Level Security (baca publik, tulis hanya admin)
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read content"
  ON content FOR SELECT USING (true);

CREATE POLICY "Public read likes"
  ON content_likes FOR SELECT USING (true);

CREATE POLICY "Public insert likes"
  ON content_likes FOR INSERT WITH CHECK (true);

CREATE POLICY "Public delete own likes"
  ON content_likes FOR DELETE USING (true);

-- ============================================================
--  SEED DATA — Contoh konten awal
-- ============================================================
INSERT INTO content
  (category, title, year, duration, rating, thumbnail_url, youtube_id, description, tags, likes, affiliate_url, affiliate_label, affiliate_desc, affiliate_badge)
VALUES
(
  'film', 'Dune: Part Two', '2024', '2j 46m', '8.5',
  'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=600&q=80',
  'Way9Dexny3w',
  'Kelanjutan epik petualangan Paul Atreides yang bergabung dengan Fremen untuk membalaskan dendam ayahnya, sembari menghadapi takdir besar sebagai pemimpin galaksi. Disutradarai Denis Villeneuve, film ini memukau dengan visual spektakuler dan narasi yang semakin dalam.',
  ARRAY['Fiksi Ilmiah','Epik','Petualangan'],
  142,
  'https://www.cgv.id', 'Beli Tiket CGV', 'Sekarang tayang di bioskop terdekat', 'Partner'
),
(
  'film', 'Inside Out 2', '2024', '1j 40m', '7.8',
  'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=600&q=80',
  'LEjhY15eCx0',
  'Riley kini remaja, dan emosi baru mulai hadir — termasuk Anxiety yang penuh kekhawatiran. Film animasi Pixar ini mengajak kita menyelami kompleksitas emosi remaja dengan cara yang hangat, lucu, dan mengharukan.',
  ARRAY['Animasi','Keluarga','Drama'],
  98,
  'https://www.disneyplus.com', 'Tonton di Disney+', 'Tersedia streaming Disney+ Hotstar', 'Streaming'
),
(
  'film', 'Oppenheimer', '2023', '3j 0m', '8.9',
  'https://images.unsplash.com/photo-1534224039826-c7a0eda0e6b3?w=600&q=80',
  'uYPbbksJxIg',
  'Christopher Nolan menghadirkan biografi brilian tentang J. Robert Oppenheimer, sang "Bapak Bom Atom". Film ini menggambarkan genius, dilema moral, dan konsekuensi dari penemuan yang mengubah dunia untuk selamanya.',
  ARRAY['Biografi','Drama','Sejarah'],
  211,
  'https://www.tokopedia.com/search?st=product&q=oppenheimer+bluray', 'Beli Blu-Ray', 'Koleksi edisi spesial di Tokopedia', 'Affiliate'
),
(
  'sains', 'Mengapa Langit Berwarna Biru?', '2024', '8 menit', '—',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80',
  NULL,
  'Fenomena hamburan Rayleigh adalah jawaban ilmiah di balik langit biru. Molekul-molekul atmosfer menghamburkan cahaya biru lebih kuat dibanding warna lain, sehingga dari mana pun kita melihat, langit tampak biru cerah.',
  ARRAY['Fisika','Atmosfer','Optik'],
  57, NULL, NULL, NULL, NULL
),
(
  'sains', 'Lubang Hitam: Portal Menuju Dimensi Lain?', '2024', '12 menit', '—',
  'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=600&q=80',
  NULL,
  'Teori-teori terkini dalam fisika kuantum mempertanyakan apakah singularitas lubang hitam adalah pintu menuju alam semesta paralel. Stephen Hawking sendiri berubah pikiran berkali-kali tentang nasib informasi yang masuk ke dalamnya.',
  ARRAY['Astrofisika','Teori Kuantum','Alam Semesta'],
  89,
  'https://www.gramedia.com/search/result/?q=lubang+hitam', 'Beli Buku Terkait', 'Temukan buku sains terbaik di Gramedia', 'Rekomendasi'
),
(
  'teknologi', 'Vision Pro: Komputer Spasial Apple', '2024', '10 menit', '—',
  'https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=600&q=80',
  NULL,
  'Apple Vision Pro hadir sebagai perangkat mixed reality pertama Apple, menggabungkan dunia nyata dengan konten digital secara mulus. Antarmuka tiga dimensi ini dikontrol dengan mata, tangan, dan suara.',
  ARRAY['Apple','VR/AR','Hardware'],
  134,
  'https://www.apple.com/shop/buy-vision-pro', 'Beli Apple Vision Pro', 'Tersedia di Apple Store resmi', 'Official'
),
(
  'teknologi', 'Quantum Computing: Revolusi Komputasi', '2024', '15 menit', '—',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80',
  NULL,
  'Komputer kuantum menggunakan qubit yang bisa berada di dua keadaan sekaligus. Google dan IBM berlomba membangun mesin yang mampu memecahkan masalah yang mustahil bagi superkomputer konvensional.',
  ARRAY['Quantum','Komputasi','Masa Depan'],
  76, NULL, NULL, NULL, NULL
),
(
  'ai', 'GPT-5 & Era AI Generatif Baru', '2024', '11 menit', '—',
  'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80',
  NULL,
  'Model bahasa generasi terbaru semakin mendekati kemampuan penalaran manusia. Dari coding otomatis hingga riset ilmiah, AI kini menjadi mitra intelektual — bukan sekadar alat.',
  ARRAY['OpenAI','LLM','Generatif AI'],
  203,
  'https://chat.openai.com', 'Coba ChatGPT Sekarang', 'Akses GPT-4 gratis di ChatGPT', 'Free Trial'
),
(
  'ai', 'AI dalam Dunia Medis: Deteksi Kanker', '2024', '9 menit', '—',
  'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=600&q=80',
  NULL,
  'Algoritma deep learning kini mampu mendeteksi kanker pada gambar medis dengan akurasi melebihi dokter spesialis. Startup medtech berlomba mengembangkan AI diagnostik yang dapat menjangkau jutaan pasien.',
  ARRAY['Medtech','Deep Learning','Kesehatan'],
  118, NULL, NULL, NULL, NULL
),
(
  'kesehatan', 'Tidur 8 Jam: Sains di Baliknya', '2024', '7 menit', '—',
  'https://images.unsplash.com/photo-1531353826977-0941b4779a1c?w=600&q=80',
  NULL,
  'Selama tidur, otak membersihkan racun, memproses memori, dan memperbaiki jaringan tubuh. Kurang tidur kronis dikaitkan dengan risiko Alzheimer, diabetes, dan penyakit jantung.',
  ARRAY['Tidur','Neurosains','Gaya Hidup'],
  95,
  'https://www.tokopedia.com/search?q=smart+sleep+tracker', 'Beli Sleep Tracker', 'Pantau kualitas tidurmu — cek di Tokopedia', 'Affiliate'
);
