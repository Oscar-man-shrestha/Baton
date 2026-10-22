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
console.log('docs/index.html and docs/uninstall.html written');
