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
});
