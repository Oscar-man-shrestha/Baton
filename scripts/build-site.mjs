// Wraps site/page.html (the published page body) into site/index.html, a full document for GitHub Pages.
import { readFileSync, writeFileSync } from 'node:fs';
const page = readFileSync(new URL('../site/page.html', import.meta.url), 'utf8');
const head = page.slice(0, page.indexOf('<style>'));
const rest = page.slice(page.indexOf('<style>'));
writeFileSync(new URL('../site/index.html', import.meta.url), `<!doctype html>
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
console.log('site/index.html written');
