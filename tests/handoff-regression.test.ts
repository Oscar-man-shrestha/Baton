import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { extract } from '../src/core/adapter';
import { draftBudget, renderBrief, updateBrief, wrapHandoff } from '../src/core/brief';
import { bundledSelectors } from '../src/core/selectors';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as typeof import('jsdom');

describe('reported DeepSeek to ChatGPT handoff', () => {
  it('carries the user goal and unanswered questions without sidebar chats or Ready-only behavior', () => {
    const doc = new JSDOM(`<aside><div class="ds-message">Advanced web animation techniques</div><div class="ds-message">Other saved chat</div></aside>
      <main><div class="ds-message">HI i wanna build to do app</div><div class="ds-message"><div class="ds-markdown">
      <p>Great! I'd love to help you build a to-do app. Let me ask a few questions so I can give you the best guidance:</p>
      <h2>1. What's your experience level?</h2><p>Beginner, intermediate, or advanced?</p>
      <h2>2. What platform?</h2><p>Web, mobile, or desktop?</p>
      <h2>3. What tech stack are you considering?</h2><p>React, Vue, or plain JavaScript?</p>
      <h2>4. What features do you want?</h2><p>Tasks, due dates, or collaboration?</p>
      <h2>5. Do you need persistence (saving data)?</h2><p>Local or cloud?</p>
      </div></div></main>`).window.document;
    const capture = extract(doc, 'deepseek', bundledSelectors);
    const draft = wrapHandoff(renderBrief(updateBrief(undefined, capture.turns, [])).text);
    expect(capture.turns.map(turn => turn.role)).toEqual(['user', 'assistant']);
    expect(draft).toContain('Goal: HI i wanna build to do app');
    expect(draft).toContain('What features do you want?');
    expect(draft).toContain('Do you need persistence (saving data)?');
    expect(draft).not.toContain('Advanced web animation techniques');
    expect(draft).not.toContain('Reply only with Ready');
    expect(draftBudget(draft).fits).toBe(true);
  });
});
