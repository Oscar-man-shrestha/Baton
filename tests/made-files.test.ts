import { describe, expect, it } from 'vitest';
import { chatgptTurns, claudeTurns, inlineFileLimit, type ClaudeConversation } from '../src/core/lossless';

const tool = (name: string, input: object) => ({ type: 'tool_use', name, input });
const claudeChat = (assistant: object[]): ClaudeConversation => ({ current_leaf_message_uuid: 'a', chat_messages: [
  { uuid: 'u', sender: 'human', content: [{ type: 'text', text: 'Build the page' }] },
  { uuid: 'a', parent_message_uuid: 'u', sender: 'assistant', content: assistant as NonNullable<ClaudeConversation['chat_messages']>[number]['content'] }
] });

describe('files the AI wrote travel with the handoff', () => {
  it('Claude: replays create_file and every str_replace edit, inline when small', () => {
    let edits = { applied: 0, skipped: 0 };
    const turns = claudeTurns(claudeChat([
      tool('create_file', { path: '/home/claude/app.py', file_text: 'print("v1")\n' }),
      tool('str_replace', { path: '/home/claude/app.py', old_str: 'v1', new_str: 'v2' }),
      tool('str_replace', { path: '/home/claude/app.py', old_str: 'not there', new_str: 'x' }),
      { type: 'text', text: 'Done.' }
    ]), made => { edits = { ...made.edits }; });
    expect(edits).toEqual({ applied: 1, skipped: 1 });
    expect(turns[1].text).toBe('Done.\n\n**app.py** (latest version):\n```py\nprint("v2")\n```');
  });
  it('Claude: says when a later command may have changed a replayed file, and attaches big files', () => {
    const big = 'x'.repeat(inlineFileLimit + 1);
    const turns = claudeTurns(claudeChat([
      tool('create_file', { path: '/mnt/user-data/outputs/site.html', file_text: big }),
      tool('bash_tool', { command: "python3 - <<'E'\ns=open('/mnt/user-data/outputs/site.html').read()\nE" }),
      { type: 'text', text: 'Patched.' }
    ]));
    expect(turns[1].text).toBe('Patched.\n\n[Files: site.html (as written in the chat; a later command may have changed it, 6k characters, attached)]');
    expect(turns[1].files?.[0]).toMatchObject({ name: 'site.html', text: big });
  });
  it('Claude: with served output files, the real final files go along instead of the replay', () => {
    const turns = claudeTurns(claudeChat([
      tool('create_file', { path: '/mnt/user-data/outputs/site.html', file_text: '<p>old</p>' }),
      tool('bash_tool', { command: 'cd /mnt/user-data/outputs && zip -r site.zip site.html' }),
      tool('present_files', { filepaths: ['/mnt/user-data/outputs/site.zip'] }),
      { type: 'text', text: 'Here you go.' }
    ]), undefined, [
      { path: '/mnt/user-data/outputs/site.html', url: '/wiggle/download-file?path=site.html' },
      { path: '/mnt/user-data/outputs/site.zip', url: '/wiggle/download-file?path=site.zip' }
    ]);
    expect(turns[1].text).toBe('Here you go.\n\n[Files: site.html, site.zip]');
    expect(turns[1].files).toEqual([
      { name: 'site.html', type: 'text/html', url: '/wiggle/download-file?path=site.html' },
      { name: 'site.zip', type: 'application/zip', url: '/wiggle/download-file?path=site.zip', shown: true }
    ]);
  });
  it('Claude: the classic artifacts tool (create, update, rewrite)', () => {
    const turns = claudeTurns(claudeChat([
      tool('artifacts', { id: 'todo', title: 'Todo list', type: 'application/vnd.ant.code', language: 'typescript', command: 'create', content: 'let a = 1;' }),
      tool('artifacts', { id: 'todo', command: 'update', old_str: 'a = 1', new_str: 'a = 2' }),
      { type: 'text', text: 'Updated.' }
    ]));
    expect(turns[1].text).toContain('**Todo list.ts** (latest version):\n```ts\nlet a = 2;\n```');
  });
  it('ChatGPT canvas: the document as created, then every pattern edit', () => {
    const node = (parent: string | null, role: string, recipient: string | undefined, content_type: string, body: string) => ({ parent, message: { author: { role }, recipient, content: content_type === 'code' ? { content_type, text: body } : { content_type, parts: [body] }, metadata: {} } });
    const turns = chatgptTurns({ current_node: 'r', mapping: {
      u: node(null, 'user', 'all', 'text', 'Write a hello script in canvas'),
      c: node('u', 'assistant', 'canmore.create_textdoc', 'code', JSON.stringify({ name: 'hello', type: 'code/python', content: 'def hi():\n    print("hi")\n' })),
      t: node('c', 'tool', 'all', 'text', 'Successfully created text document'),
      e: node('t', 'assistant', 'canmore.update_textdoc', 'code', JSON.stringify({ updates: [{ pattern: 'print\\("(\\w+)"\\)', replacement: 'print("\\1, world") # $ cost', multiple: false }] })),
      r: node('e', 'assistant', 'all', 'text', 'I added a greeting.')
    } });
    expect(turns.map(turn => turn.role)).toEqual(['user', 'assistant']);
    expect(turns[1].text).toBe('I added a greeting.\n\n**hello.py** (latest version):\n```py\ndef hi():\n    print("hi, world") # $ cost\n```');
  });
  it('a file the AI presented goes before helpers when space is short, and empty files are skipped', async () => {
    const { pickFiles, downloadFiles } = await import('../src/core/files');
    const refs = [{ name: 'README.md', url: 'r', shown: true }, { name: 'Arduino.h', url: 'a' }, { name: 'stub.ino', url: 's' }];
    expect(pickFiles(refs, { count: 2, each: 1e6, total: 1e6 }).map(ref => ref.name)).toEqual(['README.md', 'stub.ino']);
    const result = await downloadFiles([{ name: 'empty.ino', url: 'e' }, { name: 'main.ino', url: 'm' }], async ref => new Blob([ref.url === 'e' ? '' : 'void setup(){}']));
    expect(result.files.map(file => file.name)).toEqual(['main.ino']);
    expect(result.skipped).toEqual(['empty.ino']);
  });
});
