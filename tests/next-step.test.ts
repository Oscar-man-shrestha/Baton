import { describe, expect, it } from 'vitest';
import { withNextStep } from '../src/core/next-step';

describe('What’s next? line', () => {
  it('adds the next step to the end of the draft', () => {
    expect(withNextStep('Goal: login page', 'add the password reset form')).toBe('Goal: login page\n\nNext task from the user: add the password reset form');
  });
  it('leaves the draft alone when nothing is typed', () => {
    expect(withNextStep('Goal', '   ')).toBe('Goal');
    expect(withNextStep('Goal')).toBe('Goal');
  });
  it('tidies spacing, caps length and redacts secrets', () => {
    expect(withNextStep('G', 'fix\n\n  this ')).toBe('G\n\nNext task from the user: fix this');
    expect(withNextStep('G', 'x'.repeat(900)).length).toBeLessThan(560);
    expect(withNextStep('G', 'use key sk-abcdefghijklmnopqrstuvwxyz123456')).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456');
  });
});
