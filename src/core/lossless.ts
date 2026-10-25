import type { Turn } from './adapter';
import type { ProviderId } from './selectors';
import type { FileRef } from './files';

/**
 * Lossless capture: the chat as the service itself stores it, read from the page's own site with the user's session
 * (nothing leaves the browser). The page shows only the messages near the screen (Claude and ChatGPT render a moving
 * window), splits replies around tool steps, and hides file names inside buttons; the stored chat has all of it.
 * Only the branch the user is looking at is kept, and thinking, tool steps and hidden system messages are left out.
 */

type ClaudeBlock = { type: string; text?: string; name?: string; input?: { filepaths?: string[]; path?: string; file_text?: string; old_str?: string; new_str?: string; id?: string; title?: string; type?: string; language?: string; command?: string; content?: string } };
type ClaudeFile = { file_name?: string; file_kind?: string; preview_url?: string; size_bytes?: number };
type ClaudeMessage = { uuid: string; parent_message_uuid?: string; sender: string; content?: ClaudeBlock[]; text?: string; files?: ClaudeFile[]; files_v2?: ClaudeFile[]; attachments?: { file_name?: string; file_type?: string; extracted_content?: string; file_size?: number }[] };
export type ClaudeConversation = { current_leaf_message_uuid?: string; chat_messages?: ClaudeMessage[] };

type GptMessage = { author: { role: string }; recipient?: string; content: { content_type: string; parts?: unknown[]; text?: string }; metadata?: { is_visually_hidden_from_conversation?: boolean; attachments?: { id?: string; name?: string; mime_type?: string; size?: number }[] } };
export type GptConversation = { current_node?: string; mapping?: Record<string, { parent?: string | null; message?: GptMessage | null }> };

const baseName = (path: string) => path.split('/').pop() || path;
/** File names go at the end of the message, so every later step (draft, brief, exact details) carries them. */
const withFiles = (text: string, files: string[]) => {
  const names = [...new Set(files.filter(Boolean))];
  return names.length ? `${text.trim()}\n\n[Files: ${names.join(', ')}]`.trim() : text.trim();
};
const numbered = (turns: Omit<Turn, 'index'>[]): Turn[] => turns.filter(turn => turn.text).map((turn, index) => ({ ...turn, index }));

/**
 * Files the AI wrote in the chat (Claude's files and artifacts, ChatGPT's canvas). Their content is not in the chat text,
 * only in tool calls, so the latest version is rebuilt by replaying the creation and every edit in order, exactly as
 * stored. Each file then goes with the message where it last changed: inline as a code block when small (so the summary
 * and the full-chat file keep it too), attached as its own file when large.
 */
export const inlineFileLimit = 6000;
type Made = { name: string; content: string; turn: number; stale?: boolean };
export class MadeFiles {
  private files = new Map<string, Made>();
  /** Edits replayed and edits whose text was not found (shown in tests and checks; a skipped edit means an older version). */
  readonly edits = { applied: 0, skipped: 0 };
  write(key: string, name: string, content: string, turn: number) { this.files.set(key, { name, content, turn }); }
  /** A later shell command touched the file (Claude often patches files with scripts), so the replay may be behind. */
  touched(key: string) { const file = this.files.get(key); if (file) file.stale = true; }
  /** One exact replacement (Claude's str_replace and artifact updates); an edit whose text isn't found is skipped. */
  replace(key: string, before: string, after: string, turn: number) {
    const file = this.files.get(key);
    if (!file || !before || !file.content.includes(before)) { this.edits.skipped++; return; }
    file.content = file.content.replace(before, () => after); file.turn = turn; this.edits.applied++;
  }
  /** A pattern edit (ChatGPT canvas): the pattern is a regular expression; \1 in the replacement means $1. */
  pattern(key: string, pattern: string, replacement: string, all: boolean, turn: number) {
    const file = this.files.get(key);
    if (!file) return;
    try { file.content = file.content.replace(new RegExp(pattern, all ? 'gs' : 's'), replacement.replace(/\$/g, '$$$$').replace(/\\(\d)/g, '$$$1')); file.turn = turn; } catch { /* A pattern JavaScript can't read leaves the file as it was. */ }
  }
  /** Puts each file's latest version on the message where it last changed. */
  place(turns: Omit<Turn, 'index'>[], max = 12) {
    const label = (file: Made) => file.stale ? 'as written in the chat; a later command may have changed it' : 'latest version';
    const latest = [...this.files.values()].filter(file => file.content.trim() && turns[file.turn]).sort((a, b) => a.turn - b.turn).slice(-max);
    for (const file of latest) {
      const turn = turns[file.turn];
      const names = turn.text.match(/\n\n\[Files: ([^\]]+)\]$/);
      const body = names ? turn.text.slice(0, names.index) : turn.text;
      const listed = names ? names[1].split(', ') : [];
      if (file.content.length <= inlineFileLimit) {
        const fence = '`'.repeat(Math.max(3, ...(file.content.match(/`+/g) || []).map(run => run.length + 1)));
        turn.text = withFiles(`${body}\n\n**${file.name}** (${label(file)}):\n${fence}${extension(file.name)}\n${file.content.trimEnd()}\n${fence}`.trim(), listed.filter(name => name !== file.name));
      } else {
        turn.files = [...(turn.files || []).filter(ref => ref.name !== file.name), { name: file.name, type: 'text/plain', text: file.content }];
        turn.text = withFiles(body, [...listed.filter(name => name !== file.name), `${file.name} (${label(file)}, ${Math.round(file.content.length / 1000)}k characters, attached)`]);
      }
    }
  }
}
const extension = (name: string) => name.match(/\.([a-z0-9]+)$/i)?.[1] || '';
// Claude's older artifacts carry a type instead of a file name.
const artifactExtension: Record<string, string> = { 'text/markdown': 'md', 'text/html': 'html', 'image/svg+xml': 'svg', 'application/vnd.ant.react': 'jsx', 'application/vnd.ant.mermaid': 'mmd' };
const languageExtension: Record<string, string> = { python: 'py', javascript: 'js', typescript: 'ts', tsx: 'tsx', jsx: 'jsx', java: 'java', c: 'c', cpp: 'cpp', csharp: 'cs', go: 'go', rust: 'rs', ruby: 'rb', php: 'php', swift: 'swift', kotlin: 'kt', sql: 'sql', bash: 'sh', shell: 'sh', html: 'html', css: 'css', json: 'json', yaml: 'yaml', markdown: 'md', r: 'r' };
const fileName = (title: string, ext: string) => `${title.replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').trim().slice(0, 60) || 'artifact'}${ext ? `.${ext}` : ''}`;

/** Claude: follow the current branch from its last message back to the start. */
/** An output file Claude serves itself, with its real final state (fetched only when the chat is passed). */
export type ServedFile = { path: string; url: string };
const fileType = (name: string) => ({ html: 'text/html', htm: 'text/html', md: 'text/markdown', json: 'application/json', zip: 'application/zip', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', csv: 'text/csv' } as Record<string, string>)[extension(name).toLowerCase()] || 'text/plain';

/**
 * Claude: follow the current branch from its last message back to the start. With `served` (the chat's output files,
 * as Claude lists them), those files go along in their real final state, attached where they were last touched; the
 * replay of tool calls covers only files Claude doesn't serve.
 */
export function claudeTurns(conversation: ClaudeConversation, report?: (made: MadeFiles) => void, served: ServedFile[] = []): Turn[] {
  const messages = conversation.chat_messages || [];
  const byId = new Map(messages.map(message => [message.uuid, message]));
  const branch: ClaudeMessage[] = [];
  for (let at: ClaudeMessage | undefined = byId.get(conversation.current_leaf_message_uuid || '') || messages[messages.length - 1]; at && !branch.includes(at); at = byId.get(at.parent_message_uuid || '')) branch.unshift(at);
  const made = new MadeFiles();
  const madeKeys = new Set<string>(), lastTouch = new Map<string, number>(), presented = new Set<string>();
  const turns = branch.map((message, turnIndex) => {
    const blocks = message.content || [];
    for (const block of blocks) {
      const input = block.input;
      if (block.type !== 'tool_use' || !input) continue;
      const command = (input as { command?: string }).command;
      if (block.name === 'bash_tool' && typeof command === 'string') {
        for (const key of madeKeys) if (command.includes(baseName(key)) && /sed -i|>|\bcp\b|\bmv\b|\btee\b|\bpatch\b|python|perl|node\b/.test(command)) made.touched(key);
        for (const file of served) if (command.includes(baseName(file.path))) lastTouch.set(file.path, turnIndex);
      }
      for (const path of [input.path, ...(input.filepaths || [])]) if (path) { lastTouch.set(path, turnIndex); if (block.name === 'create_file') madeKeys.add(path); }
      if (block.name === 'present_files' || block.name === 'Artifact') for (const path of [...(input.filepaths || []), (input as { file_path?: string }).file_path]) if (path) presented.add(path);
      if (block.name === 'create_file' && input.path && typeof input.file_text === 'string') made.write(input.path, baseName(input.path), input.file_text, turnIndex);
      else if (block.name === 'str_replace' && input.path && typeof input.old_str === 'string') made.replace(input.path, input.old_str, input.new_str || '', turnIndex);
      else if (block.name === 'artifacts' && input.id) {
        const key = `artifact:${input.id}`;
        if ((input.command === 'create' || input.command === 'rewrite') && typeof input.content === 'string') made.write(key, fileName(input.title || input.id, artifactExtension[input.type || ''] || languageExtension[(input.language || '').toLowerCase()] || (input.type === 'application/vnd.ant.code' ? 'txt' : 'md')), input.content, turnIndex);
        else if (input.command === 'update' && typeof input.old_str === 'string') made.replace(key, input.old_str, input.new_str || '', turnIndex);
      }
    }
    const text = blocks.length ? blocks.filter(block => block.type === 'text' && block.text?.trim()).map(block => block.text!.trim()).join('\n\n') : message.text || '';
    const shown = blocks.filter(block => block.type === 'tool_use' && block.name === 'present_files').flatMap(block => block.input?.filepaths || []).map(baseName);
    // Pasted or uploaded text documents are kept inside the chat; images come back as Claude's full-size preview (WebP).
    const documents: FileRef[] = (message.attachments || []).map((file, index) => ({ name: file.file_name || `Pasted text ${index + 1}.${file.file_type === 'txt' || !file.file_type ? 'txt' : file.file_type}`, type: 'text/plain', text: file.extracted_content || '', size: file.file_size }));
    const images: FileRef[] = [...(message.files || []), ...(message.files_v2 || [])].map(file => ({ name: file.preview_url && file.file_kind === 'image' ? (file.file_name || 'image').replace(/\.[^.]+$/, '') + '.webp' : file.file_name || 'file', url: file.preview_url, size: file.size_bytes }));
    const refs = [...documents, ...images];
    return { role: message.sender === 'human' ? 'user' as const : 'assistant' as const, text: withFiles(text, [...refs.map(ref => ref.name), ...shown]), id: `claude:${message.uuid}`, ...(refs.length ? { files: refs } : {}) };
  });
  // Served output files go as themselves, on the message that last touched them (or the last reply).
  const lastReply = turns.map(turn => turn.role).lastIndexOf('assistant');
  for (const file of served) {
    const turn = turns[lastTouch.get(file.path) ?? lastReply];
    if (!turn) continue;
    const name = baseName(file.path);
    turn.files = [...(turn.files || []).filter(ref => ref.name !== name), { name, type: fileType(name), url: file.url, ...(presented.has(file.path) ? { shown: true } : {}) }];
    const names = turn.text.match(/\n\n\[Files: ([^\]]+)\]$/);
    turn.text = withFiles(names ? turn.text.slice(0, names.index) : turn.text, [...(names ? names[1].split(', ') : []).filter(item => item !== name), name]);
  }
  // With the real outputs going along, a replayed copy (often a scratch file later copied into outputs) would only be a
  // stale duplicate, so the replay is used only when Claude serves no files for the chat.
  if (!served.length) made.place(turns);
  report?.(made);
  return numbered(turns);
}

/**
 * ChatGPT's writing blocks (which replaced canvas in 2026): `:::writing{variant=… id=… title="T"}` … `:::` inside the
 * reply. The content is kept as it is, under its title; the markup goes.
 */
export function writingBlocks(text: string): string {
  return text.replace(/^:::(\w+)\{([^}\n]*)\}[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm, (_match, _kind: string, attributes: string, body: string) => {
    const title = attributes.match(/\btitle="([^"]*)"/)?.[1];
    return title ? `**${title}**\n${body}` : body;
  });
}

/** ChatGPT: the path to the current message; consecutive reply parts (around searches and tools) become one reply. */
export function chatgptTurns(conversation: GptConversation): Turn[] {
  const mapping = conversation.mapping || {};
  const path: GptMessage[] = [];
  const seen = new Set<string>();
  for (let at = conversation.current_node; at && mapping[at] && !seen.has(at); at = mapping[at].parent || undefined) { seen.add(at); const message = mapping[at].message; if (message) path.unshift(message); }
  const turns: Omit<Turn, 'index'>[] = [];
  // Canvas (older chats; ChatGPT replaced it with writing blocks in 2026): the assistant writes a document
  // (canmore.create_textdoc) and edits the open one (canmore.update_textdoc).
  const made = new MadeFiles();
  let canvas = '';
  for (const message of path) {
    const role = message.author.role;
    if (role === 'assistant' && /^canmore\.(create|update)_textdoc$/.test(message.recipient || '')) {
      let call: { name?: string; type?: string; content?: string; updates?: { pattern?: string; multiple?: boolean; replacement?: string }[] } = {};
      try { call = JSON.parse(message.content.text || (message.content.parts || []).join('')); } catch { continue; }
      if (turns[turns.length - 1]?.role !== 'assistant') turns.push({ role: 'assistant', text: '' });
      const at = turns.length - 1;
      if (message.recipient!.endsWith('create_textdoc') && typeof call.content === 'string') {
        canvas = `canvas:${call.name || at}`;
        const kind = (call.type || '').replace(/^code\//, '');
        made.write(canvas, fileName(call.name || 'Canvas', call.type === 'document' || !call.type ? 'md' : languageExtension[kind] || kind || 'txt'), call.content, at);
      } else for (const update of call.updates || []) if (canvas && typeof update.pattern === 'string') made.pattern(canvas, update.pattern, update.replacement || '', !!update.multiple, at);
      continue;
    }
    if ((role !== 'user' && role !== 'assistant') || message.metadata?.is_visually_hidden_from_conversation) continue;
    if (!['text', 'multimodal_text'].includes(message.content.content_type)) continue;
    // Citation markers (private-use characters around “cite…”) are not part of the answer.
    let text = (message.content.parts || []).filter((part): part is string => typeof part === 'string').join('\n').replace(/[^]*/g, '').replace(/[-]/g, '').trim();
    text = writingBlocks(text);
    const attached = message.metadata?.attachments || [];
    const files = attached.map(file => file.name || '');
    const refs: FileRef[] = attached.filter(file => file.id && file.name).map(file => ({ name: file.name!, type: file.mime_type, size: file.size, url: file.id!, via: 'chatgpt' as const }));
    if (!text && !files.length) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === 'assistant' && role === 'assistant') last.text = `${last.text}\n\n${withFiles(text, files)}`.trim();
    else turns.push({ role, text: withFiles(text, files), ...(refs.length ? { files: refs } : {}) });
  }
  made.place(turns);
  return numbered(turns);
}

type DeepSeekMessage = { message_id: number; parent_id: number | null; role: string; content?: string; fragments?: { type: string; content?: string; files?: { file_name?: string }[] }[]; files?: { file_name?: string }[] };
export type DeepSeekChat = { chat_session?: { current_message_id?: number }; chat_messages?: DeepSeekMessage[] };
/** DeepSeek: the current branch; your text (REQUEST) and the answer (RESPONSE), without thinking or search steps. */
export function deepseekTurns(chat: DeepSeekChat): Turn[] {
  const messages = chat.chat_messages || [];
  const byId = new Map(messages.map(message => [message.message_id, message]));
  const branch: DeepSeekMessage[] = [];
  for (let at: DeepSeekMessage | undefined = byId.get(chat.chat_session?.current_message_id ?? -1) || messages[messages.length - 1]; at && !branch.includes(at); at = at.parent_id == null ? undefined : byId.get(at.parent_id)) branch.unshift(at);
  return numbered(branch.map(message => {
    const fragments = message.fragments || [];
    const text = fragments.length ? fragments.filter(part => part.type === 'REQUEST' || part.type === 'RESPONSE').map(part => (part.content || '').trim()).filter(Boolean).join('\n\n') : message.content || '';
    const files = [...fragments.flatMap(part => part.type === 'FILE' ? part.files || [] : []), ...(message.files || [])].map(file => file.file_name || '');
    return { role: message.role === 'USER' ? 'user' as const : 'assistant' as const, text: withFiles(text, files) };
  }));
}

type PerplexityEntry = { query_str?: string; blocks?: { intended_usage?: string; markdown_block?: { answer?: string } }[]; attachments?: (string | { file_name?: string; name?: string })[] };
/** Perplexity: each entry is your question and its answer; search steps and sources are left out. */
export function perplexityTurns(entries: PerplexityEntry[]): Turn[] {
  return numbered(entries.flatMap(entry => {
    const files = (entry.attachments || []).map(file => typeof file === 'string' ? decodeURIComponent(baseName(file.split('?')[0])) : file.file_name || file.name || '');
    const refs: FileRef[] = (entry.attachments || []).flatMap((file, index) => typeof file === 'string' && /^https:/.test(file) ? [{ name: files[index], url: file }] : []);
    const answer = (entry.blocks || []).filter(block => block.intended_usage === 'ask_text').map(block => block.markdown_block?.answer?.trim() || '').filter(Boolean).join('\n\n');
    return [{ role: 'user' as const, text: withFiles(entry.query_str || '', files), ...(refs.length ? { files: refs } : {}) }, { role: 'assistant' as const, text: answer }];
  }));
}

type GrokResponse = { responseId: string; parentResponseId?: string; sender: string; message?: string; createTime?: string; error?: unknown; fileAttachmentsMetadata?: { fileName?: string; fileMimeType?: string; fileUri?: string }[] };
/** Grok: the branch with the reply on screen (?rid=), else the newest; failed replies skipped. */
export function grokTurns(responses: GrokResponse[], shown?: string): Turn[] {
  const byId = new Map(responses.map(response => [response.responseId, response]));
  const parents = new Set(responses.map(response => response.parentResponseId).filter(Boolean));
  // The reply on screen (Grok's ?rid=) decides the branch; without it, the newest one.
  const newestLeaf = responses.filter(response => !parents.has(response.responseId) && !response.error).sort((a, b) => String(b.createTime).localeCompare(String(a.createTime)))[0];
  let leaf = (shown && byId.get(shown)) || newestLeaf;
  // From a reply in the middle of the chat, follow its newest continuation down to the end.
  for (let next: GrokResponse | undefined = leaf; next; ) { next = responses.filter(response => response.parentResponseId === next!.responseId && !response.error).sort((a, b) => String(b.createTime).localeCompare(String(a.createTime)))[0]; if (next) leaf = next; }
  const branch: GrokResponse[] = [];
  for (let at: GrokResponse | undefined = leaf; at && !branch.includes(at); at = byId.get(at.parentResponseId || '')) branch.unshift(at);
  return numbered(branch.filter(response => !response.error).map(response => {
    const meta = response.fileAttachmentsMetadata || [];
    const refs: FileRef[] = meta.filter(file => file.fileUri && file.fileName).map(file => ({ name: file.fileName!, type: file.fileMimeType, url: `https://assets.grok.com/${file.fileUri}` }));
    return { role: response.sender.toLowerCase() === 'human' ? 'user' as const : 'assistant' as const, text: withFiles(response.message || '', meta.map(file => file.fileName || '')), ...(refs.length ? { files: refs } : {}) };
  }));
}

/** Gemini: turns arrive newest first; each holds your message and the reply drafts, with the one shown named at [3][3]. */
export function geminiTurns(payload: unknown): Turn[] {
  const turns = (Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : []) as unknown[][];
  const text = (value: unknown) => (typeof value === 'string' ? value : '').trim();
  return numbered([...turns].reverse().flatMap(turn => {
    const user = text((turn[2] as unknown[][] | undefined)?.[0]?.[0]);
    const reply = turn[3] as unknown[] | undefined;
    const drafts = (reply?.[0] || []) as unknown[][];
    const shown = drafts.find(draft => draft[0] === reply?.[3]) || drafts[0];
    return [{ role: 'user' as const, text: user }, { role: 'assistant' as const, text: text((shown?.[1] as unknown[] | undefined)?.[0]) }];
  }));
}

/** Reads the stored chat on this page's own site; undefined where the service or the page doesn't offer it. */
export async function fetchStoredChat(id: ProviderId, location: Location, timeout = 6000, doc: Document = document): Promise<Turn[] | undefined> {
  const path = location.pathname;
  const chat = {
    claude: path.match(/^\/chat\/([0-9a-f-]{36})/)?.[1],
    chatgpt: path.match(/\/c\/([0-9a-f-]{36})/)?.[1],
    deepseek: path.match(/\/chat\/s\/([0-9a-f-]{36})/)?.[1],
    grok: path.match(/\/(?:c|chat)\/([0-9a-f-]{36})/)?.[1],
    perplexity: path.match(/^\/search\/([^/?#]+)/)?.[1],
    gemini: path.match(/\/app\/([0-9a-f]{12,})/)?.[1]
  }[id];
  if (!chat) return undefined;
  const signal = AbortSignal.timeout(timeout);
  const json = async (url: string, init: RequestInit = {}) => { const response = await fetch(url, { credentials: 'include', ...init, signal }); if (!response.ok) throw new Error(String(response.status)); return response.json(); };
  if (id === 'claude') {
    const orgs = await json('/api/organizations') as { uuid: string; capabilities?: string[] }[];
    for (const org of [...orgs].sort((a, b) => Number((b.capabilities || []).includes('chat')) - Number((a.capabilities || []).includes('chat')))) {
      let conversation: ClaudeConversation;
      try { conversation = await json(`/api/organizations/${org.uuid}/chat_conversations/${chat}?tree=True&rendering_mode=messages&render_all_tools=true`); } catch { continue; /* Another organization may hold it. */ }
      // The chat's output files in their final state (one small listing; the files themselves are fetched only on a pass).
      const base = `/api/organizations/${org.uuid}/conversations/${chat}/wiggle`;
      const listed = await json(`${base}/list-files`).catch(() => undefined) as { files?: string[] } | undefined;
      const served = (listed?.files || []).filter(path => path.startsWith('/mnt/user-data/outputs/') && !path.endsWith('/')).map(path => ({ path, url: `${base}/download-file?path=${encodeURIComponent(path)}` }));
      return claudeTurns(conversation, undefined, served);
    }
    return undefined;
  }
  // Session tokens below are the page's own, used only for these same-site requests and never stored by Baton.
  if (id === 'chatgpt') {
    const session = await json('/api/auth/session') as { accessToken?: string };
    if (!session.accessToken) return undefined;
    return chatgptTurns(await json(`/backend-api/conversation/${chat}`, { headers: { authorization: `Bearer ${session.accessToken}` } }));
  }
  if (id === 'deepseek') {
    let token: string | undefined;
    try { token = JSON.parse(localStorage.getItem('userToken') || '{}').value; } catch { /* No session. */ }
    if (!token) return undefined;
    return deepseekTurns((await json(`/api/v0/chat/history_messages?chat_session_id=${chat}`, { headers: { authorization: `Bearer ${token}` } })).data?.biz_data || {});
  }
  if (id === 'grok') {
    const nodes = (await json(`/rest/app-chat/conversations/${chat}/response-node?includeThreads=true`)).responseNodes as { responseId: string }[] | undefined;
    if (!nodes?.length) return undefined;
    const loaded = await json(`/rest/app-chat/conversations/${chat}/load-responses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ responseIds: nodes.map(node => node.responseId) }) });
    return grokTurns(loaded.responses || [], new URLSearchParams(location.search).get('rid') || undefined);
  }
  if (id === 'perplexity') {
    const entries: PerplexityEntry[] = [];
    for (let offset = 0; offset < 1000; offset += 100) {
      const page = await json(`/rest/thread/${chat}?with_schematized_response=true&version=2.18&source=default&limit=100&offset=${offset}&from_first=true`);
      entries.push(...(page.entries || []));
      if (!page.has_next_page || !page.entries?.length) break;
    }
    return perplexityTurns(entries);
  }
  // Gemini has no plain chat address: the page's own data call, with the request token from its page script.
  const script = Array.from(doc.scripts).map(element => element.textContent || '').find(text => text.includes('"SNlM0e"')) || '';
  const value = (key: string) => script.match(new RegExp(`"${key}":"([^"]*)"`))?.[1];
  const at = value('SNlM0e'), build = value('cfb2h'), session = value('FdrFJe');
  if (!at || !build) return undefined;
  const body = new URLSearchParams({ 'f.req': JSON.stringify([[['hNvQHb', JSON.stringify([`c_${chat}`, 1000, null, 1, [1], [4], null, 1]), null, 'generic']]]), at });
  const response = await fetch(`/_/BardChatUi/data/batchexecute?rpcids=hNvQHb&source-path=${encodeURIComponent(path)}&bl=${build}&f.sid=${session || ''}&hl=en&rt=c`, { method: 'POST', body, credentials: 'include', signal, headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' } });
  if (!response.ok) return undefined;
  const line = (await response.text()).split('\n').find(row => row.startsWith('[["wrb.fr","hNvQHb"'));
  const payload = line ? JSON.parse(line)[0][2] : undefined;
  return payload ? geminiTurns(JSON.parse(payload)) : undefined;
}

/** Fetches one file of the stored chat on its own site (ChatGPT: its download link first, with the page's session). */
export async function fetchStoredFile(ref: FileRef, timeout = 20000): Promise<Blob> {
  const signal = AbortSignal.timeout(timeout);
  let url = ref.url || '';
  if (ref.via === 'chatgpt') {
    const session = await (await fetch('/api/auth/session', { credentials: 'include', signal })).json() as { accessToken?: string };
    const chat = location.pathname.match(/\/c\/([0-9a-f-]{36})/)?.[1] || '';
    const link = await (await fetch(`/backend-api/files/download/${url}?conversation_id=${chat}&inline=false`, { credentials: 'include', signal, headers: { authorization: `Bearer ${session.accessToken}` } })).json() as { download_url?: string };
    if (!link.download_url) throw new Error('No download link');
    url = link.download_url;
  }
  const response = await fetch(url, { credentials: 'include', signal });
  if (!response.ok) throw new Error(String(response.status));
  return response.blob();
}
