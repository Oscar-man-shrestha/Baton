import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { chatgptTurns, claudeTurns } from '../src/core/lossless';
import { extract } from '../src/core/adapter';
import { bundledSelectors } from '../src/core/selectors';
import { exactDetails } from '../src/core/brief';

describe('lossless capture from the stored chat', () => {
  it('Claude: the current branch only, every text part around tools, no thinking, and the files made or uploaded', () => {
    const turns = claudeTurns({
      current_leaf_message_uuid: 'a2',
      chat_messages: [
        { uuid: 'u1', parent_message_uuid: '00000000-0000-4000-8000-000000000000', sender: 'human', content: [{ type: 'text', text: 'Build the portfolio' }], files_v2: [{ file_name: 'portrait.jpg' }] },
        { uuid: 'a1', parent_message_uuid: 'u1', sender: 'assistant', content: [
          { type: 'thinking' }, { type: 'tool_use', name: 'bash_tool' }, { type: 'tool_result', name: 'bash_tool' },
          { type: 'text', text: 'I’ll scaffold the project.' }, { type: 'tool_use', name: 'present_files', input: { filepaths: ['/mnt/user-data/outputs/cinematic-portfolio-m1.zip'] } },
          { type: 'text', text: 'Milestone 1 compiles. Run npm run dev.' }] },
        { uuid: 'old', parent_message_uuid: 'a1', sender: 'human', content: [{ type: 'text', text: 'a question I edited away' }] },
        { uuid: 'u2', parent_message_uuid: 'a1', sender: 'human', content: [{ type: 'text', text: 'how to run this in VS Code' }] },
        { uuid: 'a2', parent_message_uuid: 'u2', sender: 'assistant', content: [{ type: 'thinking' }, { type: 'text', text: 'Open a terminal and run npm install.' }] }
      ]
    });
    expect(turns.map(turn => turn.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(turns[0].text).toBe('Build the portfolio\n\n[Files: portrait.jpg]');
    expect(turns[1].text).toBe('I’ll scaffold the project.\n\nMilestone 1 compiles. Run npm run dev.\n\n[Files: cinematic-portfolio-m1.zip]');
    expect(turns.map(turn => turn.text).join(' ')).not.toContain('edited away');
    expect(exactDetails(turns)).toContain('cinematic-portfolio-m1.zip');
  });
  it('ChatGPT: the current path, reply parts joined, no tool steps, thinking or hidden messages, citations removed', () => {
    const node = (parent: string | null, role: string, content_type: string, parts: unknown[], metadata = {}) => ({ parent, message: { author: { role }, content: { content_type, parts }, metadata } });
    const turns = chatgptTurns({
      current_node: 'h',
      mapping: {
        root: { parent: null, message: null },
        s: node('root', 'system', 'text', ['You are ChatGPT'], { is_visually_hidden_from_conversation: true }),
        u: node('s', 'user', 'text', ['do claude pro have gui like cursor'], { attachments: [{ name: 'notes.pdf' }] }),
        a1: node('u', 'assistant', 'text', ['']),
        t: node('a1', 'tool', 'text', ['search results']),
        th: node('t', 'assistant', 'thoughts', []),
        a2: node('th', 'assistant', 'text', ['Yes, Claude Code has a desktop app.citeturn0search1']),
        h: node('a2', 'assistant', 'text', ['hidden memory note'], { is_visually_hidden_from_conversation: true }),
        other: node('u', 'assistant', 'text', ['an older regenerated answer'])
      }
    });
    expect(turns).toEqual([
      { role: 'user', text: 'do claude pro have gui like cursor\n\n[Files: notes.pdf]', index: 0 },
      { role: 'assistant', text: 'Yes, Claude Code has a desktop app.', index: 1 }
    ]);
  });
  it('page fallback: Claude’s new reply marker, and file cards named instead of dropped', () => {
    const doc = new JSDOM(`<div data-testid="user-message">Build it</div><div data-testid="assistant-message"><div class="standard-markdown"><p>Done.</p></div><div data-testid="file-card-block"><button>Cinematic portfolio m1 ZIP</button></div></div>`).window.document;
    const turns = extract(doc, 'claude', bundledSelectors).turns;
    expect(turns.map(turn => turn.role)).toEqual(['user', 'assistant']);
    expect(turns[1].text).toBe('Done.\n\n[Files: Cinematic portfolio m1 ZIP]');
  });
  it('tells the next AI which files were in the chat', async () => {
    const { fullContext } = await import('../src/core/context-export');
    const text = fullContext({ turns: [{ role: 'user', text: 'Build it', index: 0 }, { role: 'assistant', text: 'Done.\n\n[Files: cinematic-portfolio-m1.zip]', index: 1 }], incomplete: false, truncated: false, savedAt: 0 }, 'https://claude.ai/chat/1').text;
    expect(text).toContain('Files in the chat (not attached here; ask the user to share any you need): cinematic-portfolio-m1.zip');
  });
});
