# Contributing to Baton Pass

Thanks for helping. Bug reports with the AI site, Baton version and steps are the most useful contribution: chat sites change their pages often, and a report is usually how a break is found.

## Set up

Needs Node 22.

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` opens a browser with Baton loaded and reloads it on every change. To use your own browser instead, run `npm run build` and load `.output/chrome-mv3` at `chrome://extensions` (Developer mode → Load unpacked).

## Before a pull request

```bash
npm run typecheck && npm test && npm run eval:handoff
```

- **Tests:** `tests/` uses Vitest with jsdom. A change to how a site is read needs a test with that site's markup (see `tests/adapter.test.ts`, `tests/lossless.test.ts`).
- **Handoff quality:** `npm run eval:handoff` fails if the one-click draft keeps less than 90% of the must-keep facts of the six benchmark chats. See [evaluation/README.md](evaluation/README.md).
- **Try it live** on the site you changed, signed in, and say which in the PR.
- **Privacy:** anything that reads, stores or sends something new, or adds a permission, must update [PRIVACY.md](PRIVACY.md) and [docs/store-listing.md](docs/store-listing.md).

## Code style

TypeScript, small modules in `src/core/` with a comment at the top saying what each one is for and why. Match the surrounding code; comments explain decisions, not syntax. User-facing text is plain English and says what happens, never more than the code does.

## Where things are

The architecture, pipelines and design decisions are in [docs/REPORT.md](docs/REPORT.md).

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
