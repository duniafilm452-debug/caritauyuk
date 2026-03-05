// ============================================================
// generate-sitemap.js  —  versi GitHub Actions
// Letakkan file ini di ROOT folder repository GitHub kamu
//
// Jalankan lokal  : node generate-sitemap.js
// Jalankan otomatis: lewat GitHub Actions (update-sitemap.yml)
// ============================================================

const https = require("https");
const fs    = require("fs");

// ── Konfigurasi ─────────────────────────────────────────────
// Saat dijalankan via GitHub Actions, nilai diambil dari Secrets.
// Saat dijalankan lokal, nilai diambil dari baris fallback di bawah.
const SUPABASE_URL      = process.env.SUPABASE_URL      || "https://ucguioolhvytinvqnirk.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjZ3Vpb29saHZ5dGludnFuaXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NjM0MTksImV4cCI6MjA4NzMzOTQxOX0.Y9ETtIB6QMj5D6Wp278TOLGWKFKf04ecpLHzQ3Wq2cg";
const BASE_URL          = "https://yukcaritau.my.id";
const OUTPUT_FILE       = "sitemap.xml";
// ────────────────────────────────────────────────────────────

// Halaman statis — tambah/hapus sesuai halaman di website kamu
const STATIC_PAGES = [
  { url: "/",                  changefreq: "daily",   priority: "1.0" },
  { url: "/kategori",          changefreq: "weekly",  priority: "0.8" },
  { url: "/about.html",        changefreq: "monthly", priority: "0.5" },
  { url: "/contact.html",      changefreq: "monthly", priority: "0.5" },
  { url: "/privacy-policy.html", changefreq: "monthly", priority: "0.3" },
  { url: "/terms.html",        changefreq: "monthly", priority: "0.3" },
];

// ── Ambil semua konten dari Supabase ────────────────────────
function fetchFromSupabase() {
  return new Promise((resolve, reject) => {
    const hostname = new URL(SUPABASE_URL).hostname;
    const path     = `/rest/v1/content?select=id,updated_at,category&order=updated_at.desc`;

    const options = {
      hostname,
      path,
      method: "GET",
      headers: {
        apikey:         SUPABASE_ANON_KEY,
        Authorization:  `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end",  () => {
        try {
          const parsed = JSON.parse(data);
          if (!Array.isArray(parsed)) reject(new Error("Response tidak valid: " + data));
          else resolve(parsed);
        } catch (e) {
          reject(new Error("Gagal parse JSON: " + e.message));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

// ── Format tanggal untuk sitemap ────────────────────────────
function formatDate(isoString) {
  return isoString
    ? isoString.split("T")[0]
    : new Date().toISOString().split("T")[0];
}

// ── Build XML sitemap ────────────────────────────────────────
function buildSitemap(rows) {
  const today = new Date().toISOString().split("T")[0];

  const staticEntries = STATIC_PAGES.map((page) => `
  <url>
    <loc>${BASE_URL}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join("");

  const dynamicEntries = rows.map((row) => `
  <url>
    <loc>${BASE_URL}/detail?id=${row.id}</loc>
    <lastmod>${formatDate(row.updated_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${dynamicEntries}
</urlset>`;
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("🔄 Mengambil data dari Supabase...");

  let rows;
  try {
    rows = await fetchFromSupabase();
  } catch (err) {
    console.error("❌ Gagal ambil data:", err.message);
    process.exit(1);
  }

  console.log(`✅ ${rows.length} konten ditemukan`);

  const sitemap = buildSitemap(rows);
  fs.writeFileSync(OUTPUT_FILE, sitemap, "utf-8");

  console.log(`✅ sitemap.xml berhasil dibuat!`);
  console.log(`   → ${STATIC_PAGES.length} halaman statis`);
  console.log(`   → ${rows.length} halaman artikel`);
  console.log(`   → Total: ${STATIC_PAGES.length + rows.length} URL`);
}

main();
