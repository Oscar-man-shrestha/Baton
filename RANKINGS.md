# Updating Baton's suggestions

`rankings.json` in this repository decides which AI Baton suggests for each kind of task. Every installed copy of Baton downloads it once a day from `main`, so a change here reaches users within a day, with no new release. Users can also press **Check for updates** in Settings → Services and suggestions.

## When a model gets better at something

1. Edit `bestFor` for that task: list the services best first. Keep all six ids (`chatgpt`, `claude`, `gemini`, `deepseek`, `grok`, `perplexity`); any you leave out are added at the end.
2. Optionally update `reasons`: a short phrase per service (60 characters at most), shown in the menu, for example "searches the web with sources".
3. Optionally add `keywords` for a task (for example a new framework name under `code`). They add to Baton's built-in topic words.
4. Raise `version` by 1 and set `updated` to today's date.
5. Run `npx vitest run tests/task-fit.test.ts`, then commit and push to `main`.

Tasks: `code`, `research`, `news`, `writing`, `math`, `image`, `general`.

## Rules

- An online file with a lower `version` than the one bundled in the installed Baton is ignored. A broken file is ignored too, and Baton keeps its built-in list.
- Ids for services this version of Baton does not support are ignored. A brand-new service needs a Baton release, because it needs page readers and site permissions.
- The ranking is a judgment call. Base it on the services' own announcements and public benchmarks, and note the source in the commit message.
- A user's own order in Settings always wins over this file. Their picks nudge it by at most three places.
