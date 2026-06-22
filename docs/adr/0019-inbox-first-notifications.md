# Inbox-first notifications

We will model notifications as an active-Church-scoped in-app Inbox before adding external delivery channels. A Notification is a per-User attention item, separate from Activity: Activity records what happened, while Notification records that a specific User should review it. Notification Trigger rules will live in one central notification module so new triggers can be added without scattering recipient, dedupe, and self-notification rules across mutators.

The first implementation will create Notifications for Comment Thread replies sent to live thread subscribers except the actor, filtered to Users with current Church Membership. Mention notifications are part of the trigger vocabulary, but real mention parsing is deferred until comments carry explicit mention targets rather than plain-text guesses. Notifications store references plus a lightweight display snapshot, support read/unread, soft delete, and snooze, and use per-recipient idempotency keys to avoid duplicate Inbox items.

The Inbox will be a first-class sidebar surface with the Linear-style `G` then `I` shortcut. It will reuse the existing Task Details Pane for selected notifications. Email, browser push, Slack, mobile delivery, task reminders, notification preferences, and retention caps are intentionally out of scope for the initial Inbox.
