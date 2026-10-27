import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { chatgptTurns, claudeTurns, deepseekTurns, geminiTurns, grokTurns, perplexityTurns } from '../src/core/lossless';
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
    expect(text).toContain('Files in the chat: cinematic-portfolio-m1.zip');
  });
  it('DeepSeek: the current branch, request and response only, files named', () => {
    const turns = deepseekTurns({ chat_session: { current_message_id: 5 }, chat_messages: [
      { message_id: 1, parent_id: null, role: 'USER', fragments: [{ type: 'FILE', files: [{ file_name: 'quiz.txt' }] }, { type: 'REQUEST', content: 'answer these' }] },
      { message_id: 2, parent_id: 1, role: 'ASSISTANT', fragments: [{ type: 'THINK', content: 'hmm' }, { type: 'SEARCH', content: 'Found 13 web pages' }, { type: 'RESPONSE', content: '1. B' }] },
      { message_id: 3, parent_id: 2, role: 'USER', fragments: [{ type: 'REQUEST', content: 'edited away' }] },
      { message_id: 4, parent_id: 2, role: 'USER', fragments: [{ type: 'REQUEST', content: 'and question 2?' }] },
      { message_id: 5, parent_id: 4, role: 'ASSISTANT', fragments: [{ type: 'RESPONSE', content: '2. C' }] }
    ] });
    expect(turns.map(turn => turn.text)).toEqual(['answer these\n\n[Files: quiz.txt]', '1. B', 'and question 2?', '2. C']);
  });
  it('Perplexity: each entry is a question and its answer, without plan or search steps', () => {
    const turns = perplexityTurns([
      { query_str: 'How many numbers?', blocks: [{ intended_usage: 'plan' }, { intended_usage: 'ask_text', markdown_block: { answer: 'B. 180' } }, { intended_usage: 'pro_search_steps' }] },
      { query_str: 'Why?', attachments: ['https://files.example/user/Notes%20v2.pdf?sig=1'], blocks: [{ intended_usage: 'ask_text', markdown_block: { answer: 'Because…' } }] }
    ]);
    expect(turns.map(turn => turn.text)).toEqual(['How many numbers?', 'B. 180', 'Why?\n\n[Files: Notes v2.pdf]', 'Because…']);
  });
  it('Grok: the branch ending in the newest reply; a failed reply is skipped', () => {
    const turns = grokTurns([
      { responseId: 'u1', sender: 'human', message: 'Write a script', fileAttachmentsMetadata: [{ fileName: 'Screenshot.png' }], createTime: '2026-03-23T14:50:00Z' },
      { responseId: 'bad', parentResponseId: 'u1', sender: 'ASSISTANT', message: '', error: { code: 1 }, createTime: '2026-03-23T14:57:09Z' },
      { responseId: 'a1', parentResponseId: 'u1', sender: 'assistant', message: 'Here is the script.', createTime: '2026-03-23T14:57:43Z' }
    ]);
    expect(turns.map(turn => turn.text)).toEqual(['Write a script\n\n[Files: Screenshot.png]', 'Here is the script.']);
  });
  it('Gemini: oldest first, and the reply draft that is shown', () => {
    const turn = (user: string, shown: string, drafts: [string, string][]) => [['c_1', 'r_x'], null, [[user], 1], [drafts.map(([id, text]) => [id, [text]]), null, null, shown]];
    const turns = geminiTurns([[turn('give me python code', 'rc_1', [['rc_1', 'import pandas']]), turn('review my answers', 'rc_9', [['rc_8', 'other draft'], ['rc_9', 'Q1 is right']])]]);
    expect(turns.map(turn => turn.text)).toEqual(['review my answers', 'Q1 is right', 'give me python code', 'import pandas']);
  });
  it('a long chat: clear speakers, key points first, the latest request again at the end', async () => {
    const { fullContext } = await import('../src/core/context-export');
    const { updateBrief } = await import('../src/core/brief');
    const turns = [{ role: 'user' as const, text: 'Build tidy. It must never delete anything. We decided to use typer, not argparse.', index: 0 },
      ...Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 ? 'user' : 'assistant') as 'user' | 'assistant', text: `Point ${i}: ${'details about moves.log and undo. '.repeat(20)}`, index: i + 1 })),
      { role: 'user' as const, text: 'next I want the undo command', index: 21 }];
    const archive = { turns, incomplete: false, truncated: false, savedAt: 0 };
    const text = fullContext(archive, 'https://claude.ai/chat/1', undefined, updateBrief(undefined, turns, [])).text;
    expect(text).toContain('Source: Claude, https://claude.ai/chat/1');
    expect(text).toContain('## 1. User\n\nBuild tidy.');
    expect(text).toContain('## 2. Assistant (Claude)');
    expect(text.indexOf('## Key points (from the whole chat below)')).toBeLessThan(text.indexOf('## 1. User'));
    expect(text).toContain('Turned down:\n- We decided to use typer, not argparse.');
    expect(text.trimEnd().endsWith('## Where it stopped\n\nThe user\'s latest request, word for word: “next I want the undo command”')).toBe(true);
    const short = fullContext({ ...archive, turns: turns.slice(0, 2) }, 'https://claude.ai/chat/1', undefined, updateBrief(undefined, turns.slice(0, 2), [])).text;
    expect(short).not.toContain('## Key points');
  });
});

describe('Grok: the reply on screen decides the branch', () => {
  it('follows ?rid= to an older regenerated reply, and continues below a reply in the middle', async () => {
    const { grokTurns } = await import('../src/core/lossless');
    const responses = [
      { responseId: 'u1', sender: 'human', message: 'Write a script', createTime: '2026-03-23T14:50:00Z' },
      { responseId: 'a-old', parentResponseId: 'u1', sender: 'assistant', message: 'First version', createTime: '2026-03-23T14:51:00Z' },
      { responseId: 'a-new', parentResponseId: 'u1', sender: 'assistant', message: 'Regenerated version', createTime: '2026-03-23T14:55:00Z' },
      { responseId: 'u2', parentResponseId: 'a-old', sender: 'human', message: 'Shorter please', createTime: '2026-03-23T14:52:00Z' },
      { responseId: 'a2', parentResponseId: 'u2', sender: 'assistant', message: 'Shorter version', createTime: '2026-03-23T14:53:00Z' }
    ];
    expect(grokTurns(responses).map(turn => turn.text)).toEqual(['Write a script', 'Regenerated version']);
    expect(grokTurns(responses, 'a2').map(turn => turn.text)).toEqual(['Write a script', 'First version', 'Shorter please', 'Shorter version']);
    expect(grokTurns(responses, 'a-old').map(turn => turn.text)).toEqual(['Write a script', 'First version', 'Shorter please', 'Shorter version']);
  });
});

describe('fetching a file of the stored chat', () => {
  it('follows only the site’s own paths and https links', async () => {
    const { vi } = await import('vitest');
    const { fetchStoredFile } = await import('../src/core/lossless');
    const fetched: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => { fetched.push(url); return new Response('data'); });
    try {
      await expect(fetchStoredFile({ url: '//evil.example/x' } as never)).rejects.toThrow();
      await expect(fetchStoredFile({ url: 'http://files.example/x' } as never)).rejects.toThrow();
      await expect(fetchStoredFile({ url: 'data:text/plain,hi' } as never)).rejects.toThrow();
      await fetchStoredFile({ url: '/api/files/1' } as never);
      await fetchStoredFile({ url: 'https://files.example/notes.pdf' } as never);
      expect(fetched).toEqual(['/api/files/1', 'https://files.example/notes.pdf']);
    } finally { vi.unstubAllGlobals(); }
  });
});
