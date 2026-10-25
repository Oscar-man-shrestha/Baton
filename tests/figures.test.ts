import { describe, expect, it } from 'vitest';
import { changedFigures, extractFigures, settledFigures } from '../src/core/figures';
import { checkReply, correction, handoffPoints } from '../src/core/reply-check';
import { updateBrief } from '../src/core/brief';

const trip = [
  'Plan a 10 day trip to Japan in early April for two people. Budget is $3000 each without flights.',
  "love it. we'll go with Kyoto 4 nights, Kanazawa 3, Takayama 2. is the JR pass worth it?",
  "ok skip the JR pass then. I can't decide on the ryokan in Takayama, can you compare two?"
];

describe('settled figures the next AI must not change', () => {
  it('reads figures tied to a name, carrying the unit along a list', () => {
    expect(settledFigures(trip).map(figure => `${figure.name}=${figure.number} ${figure.unit}`)).toEqual(['Kyoto=4 night', 'Kanazawa=3 night', 'Takayama=2 night']);
  });
  it('catches the real slip (ChatGPT: “three nights in Takayama”) and passes the real correct reply (Claude)', () => {
    const settled = settledFigures(trip);
    expect(changedFigures("For your 10-day Japan trip, I'd lean toward Oyado Koto no Yume. You'll have three nights in Takayama, and staying close to the old town helps.", settled).map(item => `${item.said.said} vs ${item.settled.number}`)).toEqual(['three nights in Takayama vs 2']);
    expect(changedFigures('At about $260 a night, two nights is roughly $320 less than Hiranoya Kachoan. Takayama 2 nights is plenty for the old town.', settled)).toEqual([]);
  });
  it('uses the latest figure when the user changed their mind, and ignores bare or unrelated numbers', () => {
    const settled = settledFigures(['Kyoto 4 nights please', 'actually make it Kyoto 5 nights']);
    expect(settled.map(figure => figure.number)).toEqual([5]);
    expect(changedFigures('Kyoto 5 nights works, and add 2 nights in Osaka. Keep it under 700 words.', settled)).toEqual([]);
    expect(extractFigures('max 650 words, about 200 sel roti')).toEqual([]);
  });
  it('shows on the reply card and in the correction, from Baton’s brief of the chat', () => {
    const turns = trip.flatMap((text, index) => [{ role: 'user' as const, text, index: index * 2 }, { role: 'assistant' as const, text: 'Noted.', index: index * 2 + 1 }]);
    const points = handoffPoints(updateBrief(undefined, turns, []));
    const misses = checkReply("You'll have three nights in Takayama, so book Koto no Yume and compare the ryokan options there.", points);
    expect(misses.map(miss => miss.text)).toContain('It may have a number wrong: it says “three nights in Takayama”; the chat settled on 2 nights.');
    expect(correction(misses.filter(miss => miss.kind === 'figure'))).toBe('Before you continue, a few corrections:\n- Takayama: 2 nights, as we settled (not 3).\nPlease redo your answer with these in mind.');
  });
});
