import type { Turn } from './adapter';
import type { ProviderId } from './selectors';
import type { FileRef } from './files';

/**
 * Lossless capture: the chat as the service itself stores it, read from the page's own site with the user's session
 * (nothing leaves the browser). The page shows only the messages near the screen (Claude and ChatGPT render a moving
 * window), splits replies around tool steps, and hides file names inside buttons; the stored chat has all of it.
 * Only the branch the user is looking at is kept, and thinking, tool steps and hidden system messages are left out.
 */

type ClaudeBlock = { type: string; text?: string; name?: string; input?: { filepaths?: string[] } };
type ClaudeFile = { file_name?: string; file_kind?: string; preview_url?: string; size_bytes?: number };
type ClaudeMessage = { uuid: string; parent_message_uuid?: string; sender: string; content?: ClaudeBlock[]; text?: string; files?: ClaudeFile[]; files_v2?: ClaudeFile[]; attachments?: { file_name?: string; file_type?: string; extracted_content?: string; file_size?: number }[] };
export type ClaudeConversation = { current_leaf_message_uuid?: string; chat_messages?: ClaudeMessage[] };

type GptMessage = { author: { role: string }; content: { content_type: string; parts?: unknown[]; text?: string }; metadata?: { is_visually_hidden_from_conversation?: boolean; attachments?: { id?: string; name?: string; mime_type?: string; size?: number }[] } };
export type GptConversation = { current_node?: string; mapping?: Record<string, { parent?: string | null; message?: GptMessage | null }> };

const baseName = (path: string) => path.split('/').pop() || path;
/** File names go at the end of the message, so every later step (draft, brief, exact details) carries them. */
const withFiles = (text: string, files: string[]) => {
  const names = [...new Set(files.filter(Boolean))];
  return names.length ? `${text.trim()}\n\n[Files: ${names.join(', ')}]`.trim() : text.trim();
};
const numbered = (turns: Omit<Turn, 'index'>[]): Turn[] => turns.filter(turn => turn.text).map((turn, index) => ({ ...turn, index }));

/** Claude: follow the current branch from its last message back to the start. */
export function claudeTurns(conversation: ClaudeConversation): Turn[] {
  const messages = conversation.chat_messages || [];
  const byId = new Map(messages.map(message => [message.uuid, message]));
  const branch: ClaudeMessage[] = [];
  for (let at: ClaudeMessage | undefined = byId.get(conversation.current_leaf_message_uuid || '') || messages[messages.length - 1]; at && !branch.includes(at); at = byId.get(at.parent_message_uuid || '')) branch.unshift(at);
  return numbered(branch.map(message => {
    const blocks = message.content || [];
    const text = blocks.length ? blocks.filter(block => block.type === 'text' && block.text?.trim()).map(block => block.text!.trim()).join('\n\n') : message.text || '';
    const made = blocks.filter(block => block.type === 'tool_use' && block.name === 'present_files').flatMap(block => block.input?.filepaths || []).map(baseName);
    // Pasted or uploaded text documents are kept inside the chat; images come back as Claude's full-size preview (WebP).
    const documents: FileRef[] = (message.attachments || []).map((file, index) => ({ name: file.file_name || `Pasted text ${index + 1}.${file.file_type === 'txt' || !file.file_type ? 'txt' : file.file_type}`, type: 'text/plain', text: file.extracted_content || '', size: file.file_size }));
    const images: FileRef[] = [...(message.files || []), ...(message.files_v2 || [])].map(file => ({ name: file.preview_url && file.file_kind === 'image' ? (file.file_name || 'image').replace(/\.[^.]+$/, '') + '.webp' : file.file_name || 'file', url: file.preview_url, size: file.size_bytes }));
    const refs = [...documents, ...images];
    return { role: message.sender === 'human' ? 'user' as const : 'assistant' as const, text: withFiles(text, [...refs.map(ref => ref.name), ...made]), id: `claude:${message.uuid}`, ...(refs.length ? { files: refs } : {}) };
  }));
}

/** ChatGPT: the path to the current message; consecutive reply parts (around searches and tools) become one reply. */
export function chatgptTurns(conversation: GptConversation): Turn[] {
  const mapping = conversation.mapping || {};
  const path: GptMessage[] = [];
  const seen = new Set<string>();
  for (let at = conversation.current_node; at && mapping[at] && !seen.has(at); at = mapping[at].parent || undefined) { seen.add(at); const message = mapping[at].message; if (message) path.unshift(message); }
  const turns: Omit<Turn, 'index'>[] = [];
  for (const message of path) {
    const role = message.author.role;
    if ((role !== 'user' && role !== 'assistant') || message.metadata?.is_visually_hidden_from_conversation) continue;
    if (!['text', 'multimodal_text'].includes(message.content.content_type)) continue;
    // Citation markers (private-use characters around “cite…”) are not part of the answer.
    const text = (message.content.parts || []).filter((part): part is string => typeof part === 'string').join('\n').replace(/[^]*/g, '').replace(/[-]/g, '').trim();
    const attached = message.metadata?.attachments || [];
    const files = attached.map(file => file.name || '');
    const refs: FileRef[] = attached.filter(file => file.id && file.name).map(file => ({ name: file.name!, type: file.mime_type, size: file.size, url: file.id!, via: 'chatgpt' as const }));
    if (!text && !files.length) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === 'assistant' && role === 'assistant') last.text = `${last.text}\n\n${withFiles(text, files)}`.trim();
    else turns.push({ role, text: withFiles(text, files), ...(refs.length ? { files: refs } : {}) });
  }
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
/** Grok: the branch ending in the newest message (a regenerated reply replaces the earlier one); failed replies skipped. */
export function grokTurns(responses: GrokResponse[]): Turn[] {
  const byId = new Map(responses.map(response => [response.responseId, response]));
  const parents = new Set(responses.map(response => response.parentResponseId).filter(Boolean));
  const leaf = responses.filter(response => !parents.has(response.responseId) && !response.error).sort((a, b) => String(b.createTime).localeCompare(String(a.createTime)))[0];
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
      try { return claudeTurns(await json(`/api/organizations/${org.uuid}/chat_conversations/${chat}?tree=True&rendering_mode=messages&render_all_tools=true`)); } catch { /* Another organization may hold it. */ }
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
    return grokTurns(loaded.responses || []);
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
