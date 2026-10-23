import type { Turn } from './adapter';
import type { ProviderId } from './selectors';

/**
 * Lossless capture: the chat as the service itself stores it, read from the page's own site with the user's session
 * (nothing leaves the browser). The page shows only the messages near the screen (Claude and ChatGPT render a moving
 * window), splits replies around tool steps, and hides file names inside buttons; the stored chat has all of it.
 * Only the branch the user is looking at is kept, and thinking, tool steps and hidden system messages are left out.
 */

type ClaudeBlock = { type: string; text?: string; name?: string; input?: { filepaths?: string[] } };
type ClaudeMessage = { uuid: string; parent_message_uuid?: string; sender: string; content?: ClaudeBlock[]; text?: string; files?: { file_name?: string }[]; files_v2?: { file_name?: string }[]; attachments?: { file_name?: string }[] };
export type ClaudeConversation = { current_leaf_message_uuid?: string; chat_messages?: ClaudeMessage[] };

type GptMessage = { author: { role: string }; content: { content_type: string; parts?: unknown[]; text?: string }; metadata?: { is_visually_hidden_from_conversation?: boolean; attachments?: { name?: string }[] } };
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
    const uploaded = [...(message.files || []), ...(message.files_v2 || []), ...(message.attachments || [])].map(file => file.file_name || '');
    return { role: message.sender === 'human' ? 'user' as const : 'assistant' as const, text: withFiles(text, [...uploaded, ...made]), id: `claude:${message.uuid}` };
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
    const files = (message.metadata?.attachments || []).map(file => file.name || '');
    if (!text && !files.length) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === 'assistant' && role === 'assistant') last.text = `${last.text}\n\n${withFiles(text, files)}`.trim();
    else turns.push({ role, text: withFiles(text, files) });
  }
  return numbered(turns);
}

/** Reads the stored chat on this page's own site; undefined where the service or the page doesn't offer it. */
export async function fetchStoredChat(id: ProviderId, location: Location, timeout = 6000): Promise<Turn[] | undefined> {
  const chat = id === 'claude' ? location.pathname.match(/^\/chat\/([0-9a-f-]{36})/)?.[1] : id === 'chatgpt' ? location.pathname.match(/\/c\/([0-9a-f-]{36})/)?.[1] : undefined;
  if (!chat) return undefined;
  const signal = AbortSignal.timeout(timeout);
  const json = async (url: string, headers?: Record<string, string>) => { const response = await fetch(url, { credentials: 'include', headers, signal }); if (!response.ok) throw new Error(String(response.status)); return response.json(); };
  if (id === 'claude') {
    const orgs = await json('/api/organizations') as { uuid: string; capabilities?: string[] }[];
    for (const org of [...orgs].sort((a, b) => Number((b.capabilities || []).includes('chat')) - Number((a.capabilities || []).includes('chat')))) {
      try { return claudeTurns(await json(`/api/organizations/${org.uuid}/chat_conversations/${chat}?tree=True&rendering_mode=messages&render_all_tools=true`)); } catch { /* Another organization may hold it. */ }
    }
    return undefined;
  }
  // The token is the page's own session token, used only for this same-site request and never stored.
  const session = await json('/api/auth/session') as { accessToken?: string };
  if (!session.accessToken) return undefined;
  return chatgptTurns(await json(`/backend-api/conversation/${chat}`, { authorization: `Bearer ${session.accessToken}` }));
}
