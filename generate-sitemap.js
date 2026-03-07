import { createClient } from "@supabase/supabase-js"
import fs from "fs"

const SITE_URL = "https://yukcaritau.my.id"

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Mapping kategori → path URL ──────────────────────────────
// Harus sama persis dengan yang ada di utils.js
const CATEGORY_PATH_MAP = {
    "Film"      : "film",
    "Teknologi" : "teknologi",
    "Keuangan"  : "keuangan",
    "Kesehatan" : "kesehatan",
    "Lainnya"   : "lainnya",
}

function categoryToPath(category) {
    return CATEGORY_PATH_MAP[category]
        || category.toLowerCase().replace(/\s+/g, "-")
        || "artikel"
}

// ── Fallback slug dari title ──────────────────────────────────
function slugify(title) {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
}

// ── Ambil semua post dari Supabase ───────────────────────────
async function getPosts() {
    const { data } = await supabase
        .from("content")
        .select("slug, title, created_at, category")
    return data || []
}

// ── Generate sitemap-posts.xml ───────────────────────────────
function generatePosts(posts) {
    let urls = ""

    posts.forEach(post => {
        const slug = post.slug || slugify(post.title || "")
        if (!slug) return

        const catPath = categoryToPath(post.category)
        const url = `${SITE_URL}/${catPath}/${slug}`

        urls += `
  <url>
    <loc>${url}</loc>
    <lastmod>${new Date(post.created_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    })

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

// ── Generate sitemap-pages.xml ───────────────────────────────
function generatePages() {
    const pages = [
        "",
        "/about.html",
        "/contact.html",
        "/privacy-policy.html",
        "/terms.html"
    ]

    let urls = ""
    pages.forEach(page => {
        urls += `
  <url>
    <loc>${SITE_URL}${page}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
    })

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

// ── Generate sitemap-categories.xml ─────────────────────────
function generateCategories(posts) {
    const categories = [...new Set(posts.map(p => p.category).filter(Boolean))]

    let urls = ""
    categories.forEach(cat => {
        urls += `
  <url>
    <loc>${SITE_URL}/index.html?category=${encodeURIComponent(cat)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
    })

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

// ── Generate sitemap.xml (index) ─────────────────────────────
function generateIndex() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <sitemap>
    <loc>${SITE_URL}/sitemap-pages.xml</loc>
  </sitemap>

  <sitemap>
    <loc>${SITE_URL}/sitemap-posts.xml</loc>
  </sitemap>

  <sitemap>
    <loc>${SITE_URL}/sitemap-categories.xml</loc>
  </sitemap>

</sitemapindex>`
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
    const posts = await getPosts()
    console.log(`📄 Ditemukan ${posts.length} artikel`)

    fs.writeFileSync("sitemap-posts.xml",      generatePosts(posts))
    fs.writeFileSync("sitemap-pages.xml",      generatePages())
    fs.writeFileSync("sitemap-categories.xml", generateCategories(posts))
    fs.writeFileSync("sitemap.xml",            generateIndex())

    console.log("✅ Sitemap berhasil dibuat dengan clean URL!")
}

main()