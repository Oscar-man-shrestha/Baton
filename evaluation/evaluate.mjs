import fs from 'node:fs';
import path from 'node:path';

const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
const targets = ['target-a', 'target-b'];
const root = path.dirname(new URL(import.meta.url).pathname);
const rows = [];
for (const target of targets) for (let generation = 1; generation <= 3; generation++) for (const fixture of fixtures) {
  const file = path.join(root, 'responses', target, `${fixture.id}-g${generation}.txt`);
  if (!fs.existsSync(file)) { rows.push({ target, generation, case: fixture.id, status: 'pending' }); continue; }
  const response = fs.readFileSync(file, 'utf8').toLowerCase();
  const matched = fixture.checks.filter(check => response.includes(check.toLowerCase()));
  rows.push({ target, generation, case: fixture.id, status: 'scored', score: matched.length, total: fixture.checks.length, missing: fixture.checks.filter(check => !matched.includes(check)) });
}
console.log(JSON.stringify(rows, null, 2));
if (rows.some(row => row.status === 'pending')) { console.error('Live target responses missing; no release score can be claimed.'); process.exitCode = 2; }
else if (rows.some(row => row.score < 8)) process.exitCode = 1;
