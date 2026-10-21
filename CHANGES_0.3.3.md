# Handoff 0.3.3

- Deleted captured capsules no longer leave their hidden rolling capture in backups. Before this fix, deleting a capsule only hid its URL locally (`dismissedRecentUrls`); the underlying chat text was still written to downloaded backups and uploaded by Back up now, and a restore into a clean profile brought it back as a Recent chat.
- Backups now carry the deleted-capsule URL list (optional field in the version 1 envelope, so older backup files keep validating). Restore merges it with local deletions and skips any capture on that list.
- Three regression tests: no upload/resurrection on empty-profile restore, deletion merge into an existing library, legacy version 1 files.

Verified: 118 tests in 17 files (two workers), typecheck and WXT production build. Unit-level only: the live clean-profile/second-device restore with disposable data is still pending and needs the human to sign in.

Not changed: deleting a capsule still keeps its local rolling capture hidden rather than erased, and a project restored from an older backup that predates a local project deletion can still reappear (backups record capsule-URL deletions, not project deletions).
