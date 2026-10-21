/** Serialize already-sanitized message DOM without fetching any referenced asset. */
export function messageMarkdown(root: Element): string {
  const blocks: string[] = [];
  const protect = (text: string) => `\uFFF0${blocks.push(text) - 1}\uFFF1`;
  const walk = (node: Node): string => {
    if (node.nodeType === 3) return (node.textContent || '').replace(/\s+/g, ' ');
    if (node.nodeType !== 1) return '';
    const element = node as Element;
    const tag = element.tagName;
    if (tag === 'PRE') {
      const code = element.querySelector('code');
      const content = (code || element).textContent?.replace(/\r\n?/g, '\n').trimEnd() || '';
      const language = (code?.className || '').match(/(?:language-|lang-)([\w+-]+)/)?.[1] || '';
      const runs = content.match(/`+/g) || [];
      const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
      return `\n\n${protect(`${fence}${language}\n${content}\n${fence}`)}\n\n`;
    }
    if (tag === 'BR') return '\n';
    if (tag === 'HR') return '\n\n---\n\n';
    if (tag === 'IMG') return `[Image: ${element.getAttribute('alt')?.trim() || 'no text description available'}]`;
    if (tag === 'AUDIO' || tag === 'VIDEO' || tag === 'CANVAS') return `[${tag.toLowerCase()} content is not included in this text capture]`;
    if (tag === 'TABLE') {
      const rows = Array.from(element.querySelectorAll('tr')).filter(row => row.closest('table') === element).map(row =>
        Array.from(row.children).filter(cell => /^(TD|TH)$/.test(cell.tagName)).map(cell => walk(cell).trim().replace(/\|/g, '\\|').replace(/\n+/g, '<br>')));
      if (!rows.length) return '';
      const width = Math.max(...rows.map(row => row.length));
      const format = (row: string[]) => `| ${Array.from({ length: width }, (_, i) => row[i] || '').join(' | ')} |`;
      return `\n\n${format(rows[0])}\n${format(Array(width).fill('---'))}\n${rows.slice(1).map(format).join('\n')}\n\n`;
    }
    const children = Array.from(element.childNodes).map(walk).join('');
    if (tag === 'CODE') {
      const fence = '`'.repeat(Math.max(1, ...(children.match(/`+/g) || []).map(run => run.length + 1)));
      return protect(`${fence}${children}${fence}`);
    }
    if (/^H[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag[1]))} ${children.trim()}\n\n`;
    if (tag === 'STRONG' || tag === 'B') return children.trim() ? `**${children.trim()}**` : '';
    if (tag === 'EM' || tag === 'I') return children.trim() ? `*${children.trim()}*` : '';
    if (tag === 'DEL' || tag === 'S') return `~~${children.trim()}~~`;
    if (tag === 'A') {
      const href = element.getAttribute('href') || '';
      try {
        const url = new URL(href, element.ownerDocument.baseURI);
        if (['https:', 'http:'].includes(url.protocol)) return `[${children.trim() || url.hostname}](${url.href.replace(/\)/g, '%29')})`;
      } catch { /* Keep link text when no safe address exists. */ }
      return children;
    }
    if (tag === 'LI') {
      const parent = element.parentElement;
      const start = Number(parent?.getAttribute('start') || 1);
      const prefix = parent?.tagName === 'OL' ? `${Array.from(parent.children).indexOf(element) + start}. ` : '- ';
      const body = children.trim().replace(/\n{3,}/g, '\n\n');
      return `${prefix}${body.replace(/\n/g, '\n  ')}\n`;
    }
    if (tag === 'UL' || tag === 'OL') return `\n${children.trimEnd()}\n`;
    if (tag === 'BLOCKQUOTE') return `\n\n> ${children.trim().replace(/\n/g, '\n> ')}\n\n`;
    if (tag === 'P') return `${children.trim()}\n\n`;
    if (/^(DIV|SECTION|ARTICLE)$/.test(tag) && element !== root) return `${children}\n`;
    return children;
  };
  return walk(root).replace(/[\u200B\u2060\uFEFF]/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    .replace(/\uFFF0(\d+)\uFFF1/g, (_, index: string) => blocks[Number(index)] || '');
}
