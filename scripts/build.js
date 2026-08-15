const fs = require('fs');
const path = require('path');
const marked = require('marked');
const matter = require('gray-matter');

const SITE_URL = 'https://prabodhalabs.com';
const POSTS_DIR = path.join(__dirname, '../_posts');
const SRC_DIR = path.join(__dirname, '../src');
const OUT_DIR = path.join(__dirname, '../_site');

// Create output dirs
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (!fs.existsSync(path.join(OUT_DIR, 'blog'))) fs.mkdirSync(path.join(OUT_DIR, 'blog'), { recursive: true });

function calculateReadingTime(text) {
    const wordsPerMinute = 200;
    const words = text.trim().split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
}

// 1. Read Posts
const posts = [];
if (fs.existsSync(POSTS_DIR)) {
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
        const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
        const parsed = matter(content);
        const html = marked.parse(parsed.content);
        // "2026-04-20-slug.md" -> "slug"
        const slugMatch = file.match(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/);
        const slug = slugMatch ? slugMatch[1] : file.replace('.md', '');
        
        posts.push({
            slug,
            title: parsed.data.title,
            date: new Date(parsed.data.date),
            dateStr: new Date(parsed.data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            dateIso: new Date(parsed.data.date).toISOString(),
            description: parsed.data.description || '',
            tags: parsed.data.tags || [],
            content: html,
            readingTime: calculateReadingTime(parsed.content),
            filename: file
        });
    }
}

// Sort by date descending
posts.sort((a, b) => b.date - a.date);

// 2. Generate Blog Listing
const listTemplate = fs.readFileSync(path.join(SRC_DIR, 'templates/blog-list.html'), 'utf8');
let listHtml = '';
for (const post of posts) {
    const tagsHtml = post.tags.map(t => `<span class="tag-pill ${t}">${t.replace('-', ' ')}</span>`).join('');
    listHtml += `
    <a href="/blog/${post.slug}/" class="blog-card">
        <div class="blog-card-content">
            <div class="blog-meta">
                <time datetime="${post.dateIso}">${post.dateStr}</time>
                <span>${post.readingTime} min read</span>
            </div>
            <h2>${post.title}</h2>
            <p>${post.description}</p>
            <div class="blog-tags" style="margin-bottom: 20px;">
                ${tagsHtml}
            </div>
            <span class="read-more">Read article →</span>
        </div>
    </a>`;
}
const finalListing = listTemplate.replace('<!-- POSTS_INJECT_HERE -->', listHtml);
fs.writeFileSync(path.join(OUT_DIR, 'blog/index.html'), finalListing);

// 3. Generate Individual Posts
const postTemplate = fs.readFileSync(path.join(SRC_DIR, 'templates/blog-post.html'), 'utf8');
for (const post of posts) {
    const postDir = path.join(OUT_DIR, 'blog', post.slug);
    if (!fs.existsSync(postDir)) fs.mkdirSync(postDir, { recursive: true });
    
    const tagsHtml = post.tags.map(t => `<span class="tag-pill ${t}">${t.replace('-', ' ')}</span>`).join('');
    let html = postTemplate
        .replace(/{{TITLE}}/g, post.title)
        .replace(/{{DESCRIPTION}}/g, post.description)
        .replace(/{{DATE}}/g, post.dateStr)
        .replace(/{{DATE_ISO}}/g, post.dateIso)
        .replace(/{{READING_TIME}}/g, post.readingTime)
        .replace(/{{TAGS}}/g, tagsHtml)
        .replace(/{{CONTENT}}/g, post.content);
        
    fs.writeFileSync(path.join(postDir, 'index.html'), html);
}

// 4. Generate Sitemap
let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>${SITE_URL}/</loc></url>
    <url><loc>${SITE_URL}/blog/</loc></url>`;

for (const post of posts) {
    sitemap += `\n    <url><loc>${SITE_URL}/blog/${post.slug}/</loc><lastmod>${post.dateIso}</lastmod></url>`;
}
sitemap += '\n</urlset>';
fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), sitemap);

// 5. Generate RSS
let rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
    <title>Neon Sync Blog</title>
    <link>${SITE_URL}/blog/</link>
    <description>Thoughts on puzzle games, game design, and brain training.</description>`;

for (const post of posts) {
    rss += `\n    <item>
        <title><![CDATA[${post.title}]]></title>
        <link>${SITE_URL}/blog/${post.slug}/</link>
        <description><![CDATA[${post.description}]]></description>
        <pubDate>${post.date.toUTCString()}</pubDate>
    </item>`;
}
rss += '\n</channel>\n</rss>';
fs.writeFileSync(path.join(OUT_DIR, 'rss.xml'), rss);

// 6. Copy static files
function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    if (fs.statSync(src).isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        const items = fs.readdirSync(src);
        for (const item of items) {
            // skip templates dir
            if (item === 'templates') continue;
            copyDir(path.join(src, item), path.join(dest, item));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}
copyDir(SRC_DIR, OUT_DIR);

// Root files are now handled by the src/ copyDir

console.log('Build completed!');
