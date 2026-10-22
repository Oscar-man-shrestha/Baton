# Baton 0.3.39 — suggestions from your latest message, and in the side panel

- **Your latest message decides the task.** On DeepSeek, "write a meme of my cat" was ranked as **code**. The guess had included the reply's code block (the text meme), which scored 10 for code. The guess now uses only the text in the box, or else your latest message. Replies and older messages no longer count.
- **DeepSeek replies are recognised more reliably.** A turn that contains rendered markdown, a code block, a table or a "thinking" section is read as a reply. Your own messages are plain text. Covered by a new test.
- **The menu shows what it used:** "Based on: “write a meme of my cat”", so a wrong guess is easy to spot and fix with a task chip.
- **"Pass the baton to" in Baton's side panel and popup:** it sits above Usage and needs no Capture first.
  - It shows the best three AIs for this chat, with the task, what the guess is based on, task chips and a reason for each.
  - **Pass →** saves the baton and opens that AI with your project as an unsent draft, the same action as the Baton button. It also counts as a pick for that task.
  - It refreshes when you switch chats, when you come back to Baton, and every 15 s while Baton is open.
- "make a meme / gif" now reads as images; "write a meme" stays writing.

Verified: 234 tests in 33 files, typecheck, complete build; build-1 synced with the completeness guard. Not checked live: the side panel section and Pass → on each site.
