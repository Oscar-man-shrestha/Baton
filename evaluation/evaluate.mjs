// Live handoff check: scores how real AIs continue from Baton's one-click drafts. See evaluation/README.md, “Live check”.
// Replies go in evaluation/live/replies/<ai>/<conversation>.txt (any folder name per AI, e.g. ai-1, ai-2).
// `node evaluation/evaluate.mjs --legacy` runs the older synthetic fixtures (fixtures.json, responses/target-*).
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);

if (process.argv.includes('--legacy')) {
  const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'fixtures.json'), 'utf8'));
  const rows = [];
  for (const target of ['target-a', 'target-b']) for (let generation = 1; generation <= 3; generation++) for (const fixture of fixtures) {
    const file = path.join(root, 'responses', target, `${fixture.id}-g${generation}.txt`);
    if (!fs.existsSync(file)) { rows.push({ target, generation, case: fixture.id, status: 'pending' }); continue; }
    const response = fs.readFileSync(file, 'utf8').toLowerCase();
    const matched = fixture.checks.filter(check => response.includes(check.toLowerCase()));
    rows.push({ target, generation, case: fixture.id, status: 'scored', score: matched.length, total: fixture.checks.length, missing: fixture.checks.filter(check => !matched.includes(check)) });
  }
  console.log(JSON.stringify(rows, null, 2));
  if (rows.some(row => row.status === 'pending')) { console.error('Live target responses missing; no release score can be claimed.'); process.exitCode = 2; }
  else if (rows.some(row => row.score < 8)) process.exitCode = 1;
} else {
  const conversations = JSON.parse(fs.readFileSync(path.join(root, 'handoff-conversations.json'), 'utf8'));
  const repliesDir = path.join(root, 'live', 'replies');
  const ais = fs.existsSync(repliesDir) ? fs.readdirSync(repliesDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort() : [];
  // A reply that only acknowledges, or asks for context the draft already gave, means the handoff didn't land.
  const askedAgain = /\b(?:could|can) you (?:share|paste|provide|tell me)\b.{0,60}\b(?:context|details|project|code|essay|more about)\b|\bwhat (?:are you|is your project)\b/i;
  const sentenceWith = (text, phrase) => (text.split(/(?<=[.!?])\s+|\n+/).find(line => line.toLowerCase().includes(phrase.toLowerCase())) || '').trim().slice(0, 160);
  const rows = [];
  for (const ai of ais) for (const conversation of conversations) {
    const file = path.join(repliesDir, ai, `${conversation.id}.txt`);
    const reply = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
    if (!reply) { rows.push({ ai, case: conversation.id, status: 'pending' }); continue; }
    const lower = reply.toLowerCase();
    const { mention, avoid } = conversation.replyChecks;
    const kept = mention.filter(options => options.some(option => lower.includes(option.toLowerCase())));
    const flags = [
      ...avoid.filter(phrase => lower.includes(phrase.toLowerCase())).map(phrase => `mentions “${phrase}”: ${sentenceWith(reply, phrase)}`),
      ...(reply.length < 300 ? ['very short: may only acknowledge the handoff'] : []),
      ...(askedAgain.test(reply) ? [`asks for context the draft gave: ${reply.match(askedAgain)[0]}`] : [])
    ];
    const score = kept.length / mention.length;
    rows.push({ ai, case: conversation.id, status: score >= 0.75 && !flags.length ? 'pass' : flags.length && score >= 0.75 ? 'review' : 'fail', score: `${kept.length}/${mention.length}`, missing: mention.filter(options => !kept.includes(options)).map(options => options.join(' / ')), flags });
  }
  fs.writeFileSync(path.join(root, 'live', 'results.json'), `${JSON.stringify({ scoredAt: new Date().toISOString(), rows }, null, 2)}\n`);
  if (!ais.length) console.log('No replies yet. Put each AI’s replies in evaluation/live/replies/<ai>/<conversation>.txt (see evaluation/README.md).');
  for (const row of rows) {
    console.log(`${row.ai.padEnd(12)} ${row.case.padEnd(15)} ${row.status === 'pending' ? 'pending (no reply yet)' : `${row.status.toUpperCase().padEnd(7)} ${row.score} expected points${row.missing.length ? ` · missing: ${row.missing.join('; ')}` : ''}`}`);
    for (const flag of row.flags || []) console.log(`${' '.repeat(29)}⚑ ${flag}`);
  }
  const scored = rows.filter(row => row.status !== 'pending');
  if (scored.length) console.log(`\n${scored.filter(row => row.status === 'pass').length} of ${scored.length} replies pass; ${scored.filter(row => row.status === 'review').length} need a look (⚑), ${rows.length - scored.length} pending. Saved to evaluation/live/results.json.`);
  if (!ais.length || rows.some(row => row.status === 'pending')) process.exitCode = 2;
  else if (rows.some(row => row.status === 'fail')) process.exitCode = 1;
}
