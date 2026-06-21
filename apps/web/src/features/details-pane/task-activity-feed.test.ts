import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./task-activity-feed.tsx", import.meta.url)).text();

describe("TaskActivityFeed task comments", () => {
  test("keeps the top-level comment composer after the visible activity timeline", () => {
    expect(source.indexOf('<ol aria-label="Activity"')).toBeGreaterThan(-1);
    expect(source.indexOf("<ActivityCommentComposer")).toBeGreaterThan(
      source.indexOf('<ol aria-label="Activity"'),
    );
  });

  test("submits multiline comments with either platform keyboard shortcut", () => {
    expect(source).toContain('"Leave a comment..."');
    expect(source).toContain("event.metaKey || event.ctrlKey");
    expect(source).toContain('event.key === "Enter"');
    // The composer surfaces the shortcut via the shared, platform-aware Kbd
    // (⌘ on macOS, Ctrl elsewhere) rather than a hardcoded glyph.
    expect(source).toContain("<Kbd");
    expect(source).toContain("mod enter");
  });

  test("renders top-level comments as cards that preserve plain-text formatting", () => {
    expect(source).toContain('activity.event_type === "comment_created"');
    expect(source).toContain("comment_id");
    expect(source).toContain("rounded-lg border bg-card shadow-xs");
    expect(source).toContain("whitespace-pre-wrap break-words");
  });

  test("renders one-level replies inside the parent comment card", () => {
    expect(source).toContain("repliesByParentCommentId");
    expect(source).toContain("const parentId = comment.parent_comment_id");
    expect(source).toContain("if (!parentId) continue");
    expect(source).toContain('placeholder={canReply ? "Leave a reply..."');
    expect(source).toContain("<TaskCommentReply");
  });

  test("keeps the reply composer collapsed behind a lightweight Reply affordance", () => {
    // The card leads with a compact Reply trigger and only mounts the composer
    // once the User opts in, keeping the feed scannable and Linear-like.
    expect(source).toContain("const [composing, setComposing] = useState(false)");
    expect(source).toContain("onClick={() => setComposing(true)}");
    expect(source).toContain("<CornerDownRight");
  });

  test("lets the reply composer be dismissed via Cancel or Escape", () => {
    expect(source).toContain("readonly onCancel: () => void");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("onClick={onCancel}");
  });

  test("renders edited markers and tombstones without exposing deleted bodies", () => {
    expect(source).toContain("comment.deleted_at !== null");
    expect(source).toContain("reply.deleted_at !== null");
    expect(source).toContain("This comment was deleted.");
    expect(source).toContain("This reply was deleted.");
    // The edited marker is a quiet "(edited)" affordance with an absolute-time
    // tooltip rather than a bare label.
    expect(source).toContain("function EditedMarker");
    expect(source).toContain("(edited)");
  });

  test("wires edit and delete actions through Zero mutations", () => {
    expect(source).toContain("useUpdateTaskCommentMutation");
    expect(source).toContain("useDeleteTaskCommentMutation");
  });

  test("gates edit/delete affordances on the shared moderation check", () => {
    // Authors and Church moderators (owners/admins/app admins) see the kebab,
    // mirroring the server-side canModerateTaskComment gate.
    expect(source).toContain("useTaskCommentModerationViewer");
    expect(source).toContain("canModerateTaskComment({");
  });

  test("edits comments inline instead of using a native prompt", () => {
    expect(source).not.toContain("window.prompt");
    expect(source).toContain("function CommentEditComposer");
    expect(source).toContain('aria-label="Edit comment"');
    // The inline editor only saves a genuinely changed body.
    expect(source).toContain("const isUnchanged = trimmed === initialBody.trim()");
  });

  test("confirms deletes behind an AlertDialog with a tombstone-friendly warning", () => {
    expect(source).toContain("<AlertDialog");
    expect(source).toContain("Delete this {entity}?");
    expect(source).toContain("setConfirmingDelete(true)");
    // Errors surface as a toast rather than failing silently.
    expect(source).toContain("toast.error(");
  });

  test("hides moderation actions behind a hover-revealed kebab menu", () => {
    expect(source).toContain("<DropdownMenu");
    expect(source).toContain("<MoreHorizontal");
    expect(source).toContain("group-hover/comment:opacity-100");
    expect(source).toContain("group-hover/reply:opacity-100");
  });

  test("exposes non-destructive comment menu actions without leaking deleted bodies", () => {
    expect(source).toContain("Copy content as Markdown");
    expect(source).toContain("copyCommentMarkdown(comment.body)");
    expect(source).toContain("copyCommentMarkdown(reply.body)");
    expect(source).toContain("!isDeleted ? (");
  });

  test("wires real thread subscription state separately from the header stub", () => {
    expect(source).toContain("useTaskCommentSubscriptionsForTaskCollection");
    expect(source).toContain("useSubscribeTaskCommentThreadMutation");
    expect(source).toContain("useUnsubscribeTaskCommentThreadMutation");
    expect(source).toContain("subscribedRootCommentIds.has(comment.id)");
    expect(source).toContain("Subscribe to thread");
    expect(source).toContain("Unsubscribe from thread");
    expect(source).toContain("disabled");
    expect(source).toContain("Activity header Subscribe button");
  });

  test("keeps visible attachment affordances as safe stubs in both composers", () => {
    expect(source).toContain("handleCommentAttachmentStub");
    // Both composers route through the shared AttachmentStubButton, which keeps
    // the paperclip visible, surfaces a "coming soon" tooltip, and no-ops safely.
    expect(source).toContain("function AttachmentStubButton");
    expect(source).toContain('ariaLabel="Attach file to comment"');
    expect(source).toContain('ariaLabel="Attach file to reply"');
    expect(source).toContain("Attachments are coming soon.");
    expect(source).toContain("Attachments are coming soon</TooltipContent>");
  });

  test("surfaces thread subscription state at a glance with a quiet indicator", () => {
    // Subscription state reads without opening the overflow menu, Linear-style.
    expect(source).toContain("function SubscribedIndicator");
    expect(source).toContain("subscribed ? <SubscribedIndicator /> : null");
    expect(source).toContain("You&rsquo;re subscribed to this thread");
    // Toggling the subscription confirms with a toast.
    expect(source).toContain("Subscribed to this thread.");
    expect(source).toContain("Unsubscribed from this thread.");
  });

  test("adds stable deep-link fragments for root comments and replies", () => {
    expect(source).toContain("TASK_COMMENT_FRAGMENT_PREFIX");
    expect(source).toContain("getTaskCommentFragment(comment.id)");
    expect(source).toContain("getTaskCommentFragment(reply.id)");
    expect(source).toContain("id={getTaskCommentFragment(comment.id)}");
    expect(source).toContain("id={getTaskCommentFragment(reply.id)}");
  });

  test("copies exact comment and reply links from the row action menu", () => {
    expect(source).toContain("Copy link");
    expect(source).toContain("copyTaskCommentLink(comment.id)");
    // Replies copy their own link and label the toast as a reply, not a comment.
    expect(source).toContain('copyTaskCommentLink(reply.id, "reply")');
    expect(source).toContain("`Copied ${entity} link.`");
  });

  test("scrolls to and briefly highlights comment fragments including tombstones", () => {
    expect(source).toContain("window.location.hash");
    expect(source).toContain('block: "center"');
    expect(source).toContain("setHighlightedCommentId");
    expect(source).toContain("highlightedCommentId === comment.id");
    expect(source).toContain("highlightedCommentId === reply.id");
    expect(source).toContain("ring-2 ring-primary/45");
    // The highlight pairs the ring with a soft primary tint so the found target
    // reads as a gentle "found it" flash, not just a hard outline.
    expect(source).toContain("bg-primary/5 ring-2 ring-primary/45");
  });

  test("scrolls the deep-link target smoothly while respecting reduced motion", () => {
    expect(source).toContain('"(prefers-reduced-motion: reduce)"');
    expect(source).toContain('behavior: prefersReducedMotion ? "auto" : "smooth"');
  });
});
