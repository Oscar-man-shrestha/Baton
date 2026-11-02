// Wraps site/page.html (the page source) into docs/index.html, the full document GitHub Pages serves from main /docs.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const page = readFileSync(new URL('../site/page.html', import.meta.url), 'utf8');
const head = page.slice(0, page.indexOf('<style>'));
const rest = page.slice(page.indexOf('<style>'));
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/.nojekyll', import.meta.url), '');
writeFileSync(new URL('../docs/index.html', import.meta.url), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head.trim()}
${rest.slice(0, rest.indexOf('</style>') + 8)}
</head>
<body>
${rest.slice(rest.indexOf('</style>') + 8).trim()}
</body>
</html>
`);
// The uninstall feedback page is already a full document.
copyFileSync(new URL('../site/uninstall.html', import.meta.url), new URL('../docs/uninstall.html', import.meta.url));

// PRIVACY.md as the site's privacy page, so the policy lives on Baton's own address. PRIVACY.md uses only headings,
// paragraphs, lists, tables, bold, italics, code and links, so this small converter covers it.
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = text => escape(text)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\*([^*]+)\*/g, '<i>$1</i>')
  .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
const body = [];
const lines = readFileSync(new URL('../PRIVACY.md', import.meta.url), 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  const heading = line.match(/^(#{1,3}) (.*)/);
  if (heading) { body.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue; }
  if (line.startsWith('- ')) {
    const items = [];
    for (; i < lines.length && lines[i].startsWith('- '); i++) items.push(`<li>${inline(lines[i].slice(2))}</li>`);
    i--; body.push(`<ul>${items.join('')}</ul>`); continue;
  }
  if (line.startsWith('|')) {
    const rows = [];
    for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i]);
    i--;
    const [header, , ...data] = rows;
    body.push(`<div class="table"><table><thead><tr>${cells(header).map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${data.map(row => `<tr>${cells(row).map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    continue;
  }
  body.push(`<p>${inline(line)}</p>`);
}
writeFileSync(new URL('../docs/privacy.html', import.meta.url), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Baton Pass privacy policy</title>
<meta name="description" content="What Baton Pass reads, keeps and sends, and when.">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="icon" type="image/png" href="favicon.png">
<style>
:root { --ink: #0e0c16; --ink-2: #161325; --line: #2c2744; --chalk: #f2efff; --mute: #a59fc2; --violet-soft: #c4b5ff; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--ink); color: var(--chalk); font: 17px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 48px max(16px, env(safe-area-inset-right, 0px)) 64px max(16px, env(safe-area-inset-left, 0px)); }
a { color: var(--violet-soft); }
.home { display: inline-block; margin-bottom: 24px; font-size: .95rem; }
h1 { font-size: clamp(1.9rem, 6vw, 2.6rem); line-height: 1.1; margin: 0 0 16px; }
h2 { font-size: 1.3rem; margin: 36px 0 10px; }
p, li { color: var(--chalk); }
ul { padding-left: 22px; }
code { font: .88em ui-monospace, Menlo, monospace; background: var(--ink-2); border: 1px solid var(--line); border-radius: 5px; padding: 0 5px; overflow-wrap: anywhere; }
.table { overflow-x: auto; margin: 12px 0; border: 1px solid var(--line); border-radius: 12px; }
table { border-collapse: collapse; width: 100%; font-size: .93rem; }
th, td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid var(--line); }
th { background: var(--ink-2); }
tr:last-child td { border-bottom: 0; }
</style>
</head>
<body>
<main>
<a class="home" href="./">← Baton Pass</a>
${body.join('\n')}
</main>
</body>
</html>
`);
console.log('docs/index.html, docs/uninstall.html and docs/privacy.html written');
