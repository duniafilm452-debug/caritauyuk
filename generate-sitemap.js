import { createClient } from "@supabase/supabase-js"
import fs from "fs"

const SITE_URL = "https://yukcaritau.my.id"

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function getPosts() {

const { data } = await supabase
.from("posts")
.select("slug, created_at, category")

return data || []

}

function generatePosts(posts) {

let urls = ""

posts.forEach(post => {

urls += `
<url>
<loc>${SITE_URL}/detail.html?slug=${post.slug}</loc>
<lastmod>${new Date(post.created_at).toISOString()}</lastmod>
<changefreq>weekly</changefreq>
<priority>0.8</priority>
</url>
`

})

return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

}

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
</url>
`

})

return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

}

function generateCategories(posts) {

const categories = [...new Set(posts.map(p => p.category))]

let urls = ""

categories.forEach(cat => {

urls += `
<url>
<loc>${SITE_URL}/index.html?category=${encodeURIComponent(cat)}</loc>
<changefreq>weekly</changefreq>
<priority>0.6</priority>
</url>
`

})

return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`

}

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

async function main() {

const posts = await getPosts()

fs.writeFileSync("sitemap-posts.xml", generatePosts(posts))
fs.writeFileSync("sitemap-pages.xml", generatePages())
fs.writeFileSync("sitemap-categories.xml", generateCategories(posts))
fs.writeFileSync("sitemap.xml", generateIndex())

console.log("✅ Sitemap berhasil dibuat")

}

main()