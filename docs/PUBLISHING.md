# Publishing Baton Pass

How to take Baton from this repository to the extension stores, and how to ship updates. Store field texts are in [store-listing.md](store-listing.md).

## Where Baton can be published

| Store | Reaches | Works with this build? |
|---|---|---|
| **Chrome Web Store** | Chrome, Brave, Opera, Vivaldi, Arc (all install from it) | **Yes**, this is the main target |
| **Microsoft Edge Add-ons** | Edge | **Yes**, the same zip |
| Firefox Add-ons (AMO) | Firefox | **Not yet.** Firefox has no `offscreen` or `sidePanel` API (it uses `sidebar_action`), and the name “Baton” is already taken there. Needs a Firefox build (`wxt build -b firefox`) with those two features adapted |
| Safari | Safari | Not planned (needs an Xcode wrapper and an Apple developer account) |

## 1. Before every release

Run in the project folder:

```bash
npm ci
```

```bash
npm run typecheck && npm test && npm run eval:handoff
```

```bash
npm run zip
```

That writes `.output/handoff-extension-<version>-chrome.zip` (about 23 MB; most of it is the on-device model). Then check:

- [ ] `version` in `package.json` is new (the store refuses a version it has seen). WXT copies it into the manifest.
- [ ] `CHANGELOG.md` has the release at the top.
- [ ] Load `.output/chrome-mv3` in a clean browser profile (`chrome://extensions` → Developer mode → Load unpacked) and pass one chat on two of the six sites, signed in.
- [ ] If a permission changed: `docs/store-listing.md` and `PRIVACY.md` describe it.
- [ ] `PRIVACY.md` is on the public `main` branch (the store links to it).
- [ ] `git tag v<version>` and push the tag (see section 5).

## 2. Chrome Web Store (first submission)

1. **Developer account.** Go to the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole), sign in with the Baton Google account (batonforai@gmail.com, with 2-Step Verification on), accept the developer agreement and pay the one-time **US$5** registration fee. Verify the contact email.
2. **New item.** Click **New item** and upload `.output/handoff-extension-<version>-chrome.zip`.
3. **Store listing tab.** Paste the description, choose the category and language, upload the icon, the five screenshots and the two promo tiles from `store/`, and add the website and support email. All texts: [store-listing.md](store-listing.md).
4. **Privacy practices tab.** Paste the single-purpose statement and one justification per permission, answer **No** to remote code, tick the data types listed in store-listing.md, certify the three statements, and enter the privacy policy URL.
5. **Distribution tab.** Public (or Unlisted for a quiet first release), all regions, free.
6. **Submit for review.** Reviews usually take a few days; extensions with host access to many sites or with `identity` can take longer. You get an email when it is approved or if anything is asked.
7. **After approval:** copy the store link into `README.md`, the website (`site/page.html`, then `npm run build:site`) and the welcome page.

### Why a review might be delayed or rejected, and how Baton already handles it

| Common reason | Baton |
|---|---|
| Permissions not justified, or broader than needed | Six named hosts only; no `tabs`, no `<all_urls>`; one justification per permission in store-listing.md |
| Remote code | None: model, WebAssembly engine and fonts ship in the package |
| Privacy policy missing or not matching behaviour | PRIVACY.md lists every read, every request and every permission |
| Misleading name or trademark use | Independent; trademarks named only to say which sites it works on, with a non-affiliation line |
| Single purpose unclear | One statement: continue an AI chat in another AI |

## 3. Microsoft Edge Add-ons

1. Register at [Microsoft Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview) (free).
2. **Create new extension**, upload the **same zip**.
3. Reuse the texts and images from store-listing.md (Edge asks for the same fields plus a search-terms list: `ChatGPT, Claude, Gemini, AI chat, handoff, usage limit, context`).
4. Submit. Reviews take up to about a week.

## 4. Updates

1. Make the change, add a CHANGELOG entry, bump `version` in `package.json` (for example `1.1.0` → `1.1.1` for fixes, `1.2.0` for features).
2. Run section 1.
3. In the dashboard: the item → **Package** → **Upload new package**, then **Submit for review**. Users get the update automatically within hours of approval.
4. If the update adds a permission with an install warning, Chrome disables Baton for existing users until they accept it, so avoid new warning-level permissions in small updates.

Selector fixes for a changed chat site go out the same way. (The code also has a hash-verified remote selector updater, switched off; it would need a privacy-policy change before use.)

## 5. GitHub release

```bash
git tag -a v1.1.0 -m "Baton Pass 1.1.0"
```

```bash
git push origin main --tags
```

On GitHub: **Releases → Draft a new release**, pick the tag, paste the CHANGELOG section, and attach the store zip, so people can install it unpacked before (or without) the store. The CI workflow (`.github/workflows/ci.yml`) builds and tests every push, and stores the zip as a build artifact.

## 6. Keep the public pieces live

| Piece | Where | Must stay reachable because |
|---|---|---|
| Privacy policy | `PRIVACY.md` on `main` | The store listing links to it |
| `rankings.json` | repository root on `main` | Installed copies download it daily (they keep their built-in list if it's missing) |
| Website and uninstall page | `docs/` via GitHub Pages | The uninstall page opens when someone removes Baton |
| Supabase project | `qeoduozlznznptwsfzbt.supabase.co` | Backups and feedback |

Renaming the repository or the GitHub account breaks these links for installed copies, so treat them as permanent addresses.
