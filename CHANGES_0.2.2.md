# Handoff 0.2.2 — simpler capture and clearer usage

2026-10-21

## What changed

- Home has one main action: Capture this chat. Removed the statistics grid; folders live in Saved. Older-message capture and manual context are under More capture options.
- Review shows the goal and capture receipt. Review context, then choose a destination and open an unsent draft. Detailed summaries, transfer mode, project saving and exports live under More options.
- Active-service usage appears beside the capture workflow. Claude has a Read usage action: read an already-open usage page or open Claude settings. Visible readings propagate to the prompt strip through local storage.
- Claude settings detection recognizes bounded plain-text feature rows, including nested labels with reset text between the label and percentage. It does not combine session and weekly values or read other extensions’ widgets.
- Popup and sidebar share synchronized markup with a regression check.

## Design reference

Used the user's Stitch connection to generate and inspect screen `7e3a281a2b894a62bbb03bb3954ad873` in project `5032924933235062153`. Reference image: sibling `stitch-designs/simple-popup-reference.png`. Applied the simpler hierarchy, charcoal/violet palette, compact usage and restrained interactions. Did not copy fictional model labels, quota values, memory counters, or cloud/privacy claims from the generated mockup. No remote UI assets or API key are shipped.

Compared Claude Monitor's [optional composer bar](https://github.com/claude-monitor/claude-monitor-browser-extension/blob/main/extension/page/bar.js) and [feature explanation](https://claude-monitor.com/), reviewed 2026-10-21. Its private usage requests and response interception are not enabled in Handoff under the existing restrictions and unresolved conditional authorization. A display pattern cannot make hidden quotas observable.

## Actual verification

- 104 tests in 15 files passed; TypeScript and production WXT build passed.
- Isolated Brave fixtures: popup, Saved, folder creation, sidebar, review gate, unsent draft, full copy, redaction, 31% session/5% weekly Claude card and Read usage navigation. No page errors or external UI requests.
- Packaged content fixture: 12 virtualized turns, scroll restoration, streaming merge, cross-tab usage update, below-composer non-interactive strip and draft insertion without submit.
- Signed-in live Claude and other providers were not tested. Claude Free may expose no usable percentage. Unknown stays unknown; exact all-provider quotas are not claimed.
- Google/Supabase cloud configuration and live authorization/storage tests remain pending. Local saved contexts and full backups continue to work without sign-in.
