# Comments Render Through the Activity Feed

Task Comments are first-class Zero-backed rows, but the Task Activity feed positions top-level comment thread cards by `comment_created` Activity rows. Replies, edits, deletes, and thread subscriptions are also logged as Activity for audit/history, but they do not render as separate visible feed rows; instead the visible comment card reads current comment state, shows replies inline, shows tombstones for soft-deleted comments, and preserves stable deep links to root comments and replies. This keeps the feed Linear-like and audit-friendly without duplicating comment actions as noisy system events.

Thread subscriptions are real persisted data in the comment model, while task-level subscription and notification delivery remain stubs until notification scope is designed. Comment bodies start as plain text with attachment, mention, Markdown, and reaction seams intentionally deferred.
