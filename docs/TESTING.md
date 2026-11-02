# Testing Baton Pass

Thank you for testing! Baton Pass is a browser extension that moves an AI chat (ChatGPT, Claude, Gemini, DeepSeek, Grok or Perplexity) into another AI, so you can keep going when you hit a limit or want a second opinion. It takes about 20 minutes.

**Safe to try:** Baton never sends a message for you. It only types a draft into the chat box, and you decide whether to press Send. Everything it saves stays in your browser.

## 1. Install Baton (1 minute)

You need **Chrome, Brave, Edge, Opera, Vivaldi or Arc** on a computer. Phones are not supported.

1. Open **[Baton Pass on the Chrome Web Store](https://chromewebstore.google.com/detail/baton-pass/geklhdkeioejfjlpkgjcgmnhbifabknb)** and press **Add to Chrome** (the button names your browser), then **Add extension**.
2. Click the puzzle-piece icon in the toolbar and **pin Baton Pass**, so its icon is always visible.

A welcome page opens. That means it worked. If you installed an earlier test copy with **Load unpacked**, remove it first on your browser's extensions page so only one Baton runs.

## 2. What to test

Use your own accounts and real chats. Each test says what you should see; tell us whenever something is different.

| # | Try this | You should see |
|---|---|---|
| 1 | Open ChatGPT, Claude or Gemini | A small **usage bar** under the chat box, and a round **glowing Baton button** next to it |
| 2 | Open a real chat with a few messages, click the **Baton button**, pick another AI | The other AI opens in a new tab with your chat typed in as a draft, and a line like “**12 messages (6 yours, 6 replies), in order**”. Read it, then press **Send** |
| 3 | Wait for that AI's first reply | Either a short “**✓ … picked up the handoff**”, or a card saying what it may have missed, with **Put a correction in the chat box** |
| 4 | Pass a chat where **you uploaded a file**, or where Claude **made files** for you | The files appear attached in the new AI's chat box (a few seconds after the text) |
| 5 | **Select some text** in a chat and click **Save as baton** | It's saved; open Baton's icon to find it, and pass just that part |
| 6 | In the Baton menu, choose **Have … write the handoff**, press Send, wait for the reply | Baton checks the AI's summary and offers the next AI |
| 7 | Open a **long chat** (60+ messages) | After about 20 seconds, a card suggests starting fresh with a handoff |
| 8 | Press **⌘⇧U** (Mac) or **Ctrl+Shift+U** (Windows) on a chat | The Baton menu opens |

You don't have to do all eight. Tests 1–3 matter most.

**Please skip:** signing in with Google in Baton (the optional backup). It can't work in a test copy; that's expected and not a bug.

## 3. Tell us what happened

The quickest way: click the Baton icon → **Send feedback** at the bottom. Say:

- **Which AI** you passed from and to.
- **What you expected** and **what happened** instead.
- If you can, a **screenshot** (send it to the person who invited you; the feedback form takes text only).

Things we especially want to hear:
- The draft was missing something important from your chat.
- The next AI didn't continue properly (asked you to repeat yourself, ignored what you'd decided).
- The correction card was wrong (flagged something that was fine, or missed a real slip).
- Anything confusing, slow, or in the way.

Your feedback is stored in Baton's own feedback table and read only by the developer. Don't paste passwords or private details into it.

## 4. When you're done

You can keep using it, or remove it: on the extensions page, click **Remove** under Baton Pass, then delete the folder. Removing it deletes everything Baton saved.

## For the developer: sharing the test build

- Build it with `npm run zip` → `.output/handoff-extension-<version>-chrome.zip`, or download the `baton-pass-chrome` artifact from the latest CI run on GitHub.
- Unpacked copies get a random extension ID, so Google sign-in (Drive backup) won't work for testers. Everything else needs no account.
- Feedback arrives in the Supabase table `baton_feedback` (see `docs/setup/SETUP_FEEDBACK_AND_DRIVE.md`).
