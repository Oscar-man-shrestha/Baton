# Handoff: frontend brief for Stitch

Design an original, compact browser extension for saving an AI conversation and continuing it in another AI service. Use the actual product behavior in PROJECT_REPORT.md. Create a calm library dashboard like the supplied Capsule reference in its information hierarchy; retain Handoff's own name, arrow mark, copy, and colors. Do not reproduce competitor logos or imply unsupported features.

## Constraints

400 × 600 browser popup with an internal scroll area and reachable primary action; responsive side panel from 320 pixels. Dark charcoal/violet and a light theme. Local system fonts and icons, restrained borders, clear type hierarchy. Short purposeful transitions only; support reduced motion, keyboard focus, sufficient contrast, and screen-reader labels. Avoid 3D canvases, animated backgrounds, mandatory onboarding, or dense settings on Home.

## Screens

1. Home: brand; Local/Connected account access; sidebar/settings buttons; Home/Saved tabs; real Contexts/Projects/Folders counts; Capture this chat; optional older-message capture; New context/New folder; recent cards with title/date; honest empty state. No fake Teams count.
2. Captured context: concise goal/progress/next-step preview, coverage receipt, compact/full selection. Details/editor collapsed initially. Review & continue is the primary action. After review, show destination and Open draft. Keep Copy and the primary action in a sticky footer.
3. Editor: editable outbound context; explicit next-task input; token budget and omitted/redacted-detail receipt. Over-budget means preserve text and offer copy/download, not silent truncation.
4. Saved: searchable projects/recent contexts and folder metadata. Reopen exact edited drafts. Folder creation and editing should use a focused dialog.
5. Usage: same visual pattern across six providers, but only real service-exposed values. Session/weekly/model/feature limits remain distinct. Include used/left labels, a thin bar, reset countdown, source time, and unknown/stale states. Do not fill missing values with 0%. A narrow below-composer strip must never cover typing, voice, attachment, or send controls.
6. Account/backups: local use without login. Download/restore full backup. Google sign-in is visible as functional only when Supabase is configured; otherwise explain setup pending. Explain what is uploaded, with Back up now, Restore, Disconnect, and Delete cloud backup. No simulated signed-in avatar.
7. Settings: project search, folder management, retention/deletion, service toggles, diagnostics. Keep advanced configuration out of the capture flow.

## Required states

Unsupported page; existing page connecting without reload; empty new chat; capture progress; streaming reply; incomplete history; storage failure; saved; copied; oversize full context; no available quota; old quota; reset elapsed; sign-in cancelled/offline; backup conflict preview; cloud setup pending; sidebar unavailable.

## Copy and behavior

Use familiar words and make the next action obvious. “Captured” means rendered text, not hidden history/media. “Saved” means a successful local write. “Connected” requires verified app authentication. “Usage unknown” is an honest state. Every transfer is an unsent draft and the user sends it themselves.

Existing Stitch references: sibling `stitch-designs/` contains review/settings HTML and images plus DESIGN.md. Those are design references, not production pages; the extension bundles local assets only.
