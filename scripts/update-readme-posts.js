// Ghi lại danh sách bài viết mới nhất trong README, đọc từ RSS của blog.
//
// Không dùng action của bên thứ ba: action chạy với quyền ghi vào chính repo
// này, nên đổi lại là vài chục dòng tự đọc được. Không phụ thuộc npm nào —
// fetch có sẵn từ Node 18, RSS thì bóc bằng biểu thức chính quy.
//
//   node scripts/update-readme-posts.js            ghi vào README.md
//   node scripts/update-readme-posts.js --dry-run  chỉ in ra, không ghi

const fs = require('fs');

const FEED = 'https://tiennhm.io.vn/blog/rss.xml';
const README = 'README.md';
const COUNT = 5;
const START = '<!-- BLOG-POST-LIST:START -->';
const END = '<!-- BLOG-POST-LIST:END -->';

const ENTITIES = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&apos;': "'", '&#39;': "'", '&nbsp;': ' ',
};

function decode(text) {
    return text
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&[a-z]+;|&#39;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e)
        .trim();
}

function parse(xml) {
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
        const pick = (tag) => {
            const m = item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
            return m ? decode(m[1]) : '';
        };
        return { title: pick('title'), link: pick('link') };
    });
}

(async () => {
    const res = await fetch(FEED, { headers: { 'user-agent': 'readme-updater' } });
    if (!res.ok) throw new Error(`RSS trả ${res.status}`);

    const posts = parse(await res.text())
        .filter((p) => p.title && p.link)
        .slice(0, COUNT);

    if (posts.length === 0) throw new Error('feed không có item nào đọc được');

    // Ngoặc vuông cắt đứt cú pháp link; dấu nhọn thành HTML thô trong README.
    const escape = (text) =>
        text.replace(/[[\]]/g, '\\$&').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const list = posts.map((p) => `- [${escape(p.title)}](${p.link})`).join('\n');

    const readme = fs.readFileSync(README, 'utf8');
    const start = readme.indexOf(START);
    const end = readme.indexOf(END);
    if (start === -1 || end === -1 || end < start) {
        throw new Error(`README thiếu cặp mốc ${START} ... ${END}`);
    }

    const updated =
        readme.slice(0, start + START.length) + '\n' + list + '\n' + readme.slice(end);

    if (updated === readme) {
        console.log('Không có bài mới, README giữ nguyên.');
        return;
    }
    if (process.argv.includes('--dry-run')) {
        console.log(list);
        return;
    }
    fs.writeFileSync(README, updated);
    console.log(`Cập nhật ${posts.length} bài mới nhất.`);
})().catch((err) => {
    console.error('Lỗi:', err.message);
    process.exit(1);
});
