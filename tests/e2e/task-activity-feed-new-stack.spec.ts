import { expect, type Page, test } from "@playwright/test";

import { startAuthenticatedSession } from "./helpers";

// The Activity Feed is fed by Activities written through Zero in the same
// mutation as each Task change, so this needs the local Postgres/Zero stack
// booted by `bun run test:e2e` with CHURCH_TASK_E2E_ONBOARDING_STACK=1.
test.skip(
  process.env.CHURCH_TASK_E2E_ONBOARDING_STACK !== "1",
  "Run with the onboarding stack (CHURCH_TASK_E2E_ONBOARDING_STACK=1) to boot the local Postgres/Zero stack.",
);

test.setTimeout(120_000);

const detailsPane = (page: Page) => page.getByRole("dialog", { name: "Details Pane" });

const activityFeed = (page: Page) => detailsPane(page).getByRole("list", { name: "Activity" });

const subTasks = (page: Page) => detailsPane(page).getByRole("region", { name: "Sub-tasks" });

async function createTask(page: Page, title: string, team: string) {
  await page.getByRole("main").getByRole("button", { name: "Create Task" }).click();
  const dialog = page.getByRole("dialog", { name: /New Task/ });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Task title").fill(title);

  const teamPicker = dialog.getByLabel("Team");
  await expect(teamPicker).toBeVisible();
  await teamPicker.click();
  await page.getByRole("option", { name: team }).click();

  await dialog.getByRole("button", { name: "Create Task" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 20_000 });
}

async function openTaskDetails(page: Page, title: string, team: string) {
  await createTask(page, title, team);
  const card = page.getByLabel(`Task card ${title}`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.click();

  const pane = detailsPane(page);
  await expect(pane).toBeVisible();
  await expect(pane.getByRole("textbox", { name: "Task title" })).toHaveValue(title);
  return pane;
}

test.describe("Task details Activity Feed", () => {
  test("shows a created entry and a rich status-change entry", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Activity Church ${suffix}`,
      email: `activity-${suffix}@example.com`,
      userName: "E2E Activity Owner",
    });

    const pane = await openTaskDetails(page, `Activity Task ${suffix}`, "Worship");

    // The Activity section header and the creation line render for a fresh Task.
    await expect(pane.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(pane.getByText("created this task", { exact: false })).toBeVisible({
      timeout: 20_000,
    });

    // Change the status via the pane's shortcut + picker. The mutator writes a
    // task.status_changed Activity carrying { from: To Do, to: In Progress },
    // which the feed renders as a single from/to line.
    await page.keyboard.press("KeyS");
    await page.getByRole("option", { name: "In Progress" }).click();

    await expect(
      pane.getByText("moved this from To Do to In Progress", { exact: false }),
    ).toBeVisible({ timeout: 20_000 });

    // The actor's name leads the entry, and the entries survive a reload (proving
    // they are persisted Activities, not optimistic UI only).
    await expect(activityFeed(page).getByText("E2E Activity Owner").first()).toBeVisible();

    await page.reload();
    await expect(detailsPane(page)).toBeVisible();
    await expect(
      detailsPane(page).getByText("moved this from To Do to In Progress", { exact: false }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(detailsPane(page).getByText("created this task", { exact: false })).toBeVisible();
  });

  test("renders a rich team-change entry", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Activity Team Church ${suffix}`,
      email: `activity-team-${suffix}@example.com`,
      userName: "E2E Activity Team Owner",
    });

    const pane = await openTaskDetails(page, `Activity Team Task ${suffix}`, "Worship");

    // Move the Task to a different Team. The mutator writes a task.team_changed
    // Activity with { from: Worship, to: Production }, rendered as a single line.
    const teamChip = pane.getByTestId("task-details-team-trigger");
    await page.keyboard.press("KeyT");
    await page.getByRole("option", { name: "Production" }).click();
    await expect(teamChip).toContainText("Production");

    await expect(pane.getByText("moved this to the Production team", { exact: false })).toBeVisible(
      { timeout: 20_000 },
    );
  });

  test("adds a top-level Task Comment to the Activity feed", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Activity Comment Church ${suffix}`,
      email: `activity-comment-${suffix}@example.com`,
      userName: "E2E Comment Owner",
    });

    const pane = await openTaskDetails(page, `Activity Comment Task ${suffix}`, "Worship");
    const commentBody = `This is a persisted top-level comment ${suffix}`;

    await pane.getByRole("textbox", { name: "Add a comment" }).fill(commentBody);
    await pane.getByRole("button", { exact: true, name: "Comment" }).click();

    await expect(activityFeed(page).getByText("E2E Comment Owner").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(activityFeed(page).getByText(commentBody)).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(detailsPane(page)).toBeVisible();
    await expect(activityFeed(page).getByText(commentBody)).toBeVisible({ timeout: 20_000 });
  });

  test("supports Task Comment menu actions and thread subscriptions", async ({
    context,
    page,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await startAuthenticatedSession(page, {
      churchName: `E2E Activity Menu Church ${suffix}`,
      email: `activity-menu-${suffix}@example.com`,
      userName: "E2E Menu Owner",
    });

    const pane = await openTaskDetails(page, `Activity Menu Task ${suffix}`, "Worship");
    const commentBody = `Comment with **Markdown** menu actions ${suffix}`;

    await pane.getByRole("textbox", { name: "Add a comment" }).fill(commentBody);
    await pane.getByRole("button", { exact: true, name: "Comment" }).click();

    const commentCard = activityFeed(page).getByRole("listitem").filter({ hasText: commentBody });
    await expect(commentCard).toBeVisible({ timeout: 20_000 });

    await commentCard.hover();
    await commentCard.getByLabel("Comment actions").click();
    await page.getByRole("menuitem", { name: "Copy content as Markdown" }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(commentBody);

    await commentCard.hover();
    await commentCard.getByLabel("Comment actions").click();
    await page.getByRole("menuitem", { name: "Subscribe to thread" }).click();
    await expect(commentCard.getByLabel("Subscribed to this thread")).toBeVisible({
      timeout: 20_000,
    });

    await page.reload();
    const reloadedCard = activityFeed(page).getByRole("listitem").filter({ hasText: commentBody });
    await expect(reloadedCard.getByLabel("Subscribed to this thread")).toBeVisible({
      timeout: 20_000,
    });

    await reloadedCard.hover();
    await reloadedCard.getByLabel("Comment actions").click();
    await page.getByRole("menuitem", { name: "Unsubscribe from thread" }).click();
    await expect(reloadedCard.getByLabel("Subscribed to this thread")).not.toBeVisible({
      timeout: 20_000,
    });

    await pane.getByLabel("Attach file to comment").click();
    await expect(page.getByText("Attachments are coming soon.")).toBeVisible();
  });

  test("creates Tasks and Subtasks from Task Comments", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Activity Comment Tasks Church ${suffix}`,
      email: `activity-comment-tasks-${suffix}@example.com`,
      userName: "E2E Comment Task Owner",
    });

    const parentTitle = `Activity Comment Source ${suffix}`;
    const pane = await openTaskDetails(page, parentTitle, "Worship");
    const commentBody = `Follow up with choir ${suffix}\nBring the updated stage plot.`;

    await pane.getByRole("textbox", { name: "Add a comment" }).fill(commentBody);
    await pane.getByRole("button", { exact: true, name: "Comment" }).click();

    const commentCard = activityFeed(page).getByRole("listitem").filter({ hasText: commentBody });
    await expect(commentCard).toBeVisible({ timeout: 20_000 });

    await commentCard.hover();
    await commentCard.getByLabel("Comment actions").click();
    await page.getByRole("menuitem", { name: "New Task from comment" }).click();

    const taskDialog = page.getByRole("dialog", { name: /New Task/ });
    await expect(taskDialog).toBeVisible();
    await expect(taskDialog.getByPlaceholder("Task title")).toHaveValue(
      `Follow up with choir ${suffix}`,
    );
    await expect(taskDialog.getByLabel("Add description")).toContainText(
      `@E2E Comment Task Owner said in`,
    );
    await expect(taskDialog.getByLabel("Add description")).toContainText(
      `> Bring the updated stage plot.`,
    );
    await taskDialog.getByRole("button", { name: "Create Task" }).click();
    await expect(taskDialog).not.toBeVisible({ timeout: 20_000 });

    // The details pane is modal, so the board behind it is hidden from the
    // accessibility tree while the pane is open. Close it before asserting the
    // comment-derived Task card appeared on the board, then reopen the source
    // Task to continue exercising comment actions from the Activity feed.
    await detailsPane(page).getByRole("button", { name: "Close" }).click();
    await expect(page.getByLabel(`Task card Follow up with choir ${suffix}`)).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel(`Task card ${parentTitle}`).click();
    await expect(detailsPane(page)).toBeVisible();
    await expect(detailsPane(page).getByRole("textbox", { name: "Task title" })).toHaveValue(
      parentTitle,
    );
    const reopenedCommentCard = activityFeed(page).getByRole("listitem").filter({
      hasText: commentBody,
    });
    await expect(reopenedCommentCard).toBeVisible({ timeout: 20_000 });

    await reopenedCommentCard.hover();
    await reopenedCommentCard.getByLabel("Comment actions").click();
    await page.getByRole("menuitem", { name: "New Subtask from comment" }).click();

    const subtaskDialog = page.getByRole("dialog", { name: /New Subtask/ });
    await expect(subtaskDialog).toBeVisible();
    await expect(
      subtaskDialog.getByLabel(new RegExp(`Subtask of .* ${parentTitle}`)),
    ).toBeVisible();
    await expect(subtaskDialog.getByPlaceholder("Task title")).toHaveValue(
      `Follow up with choir ${suffix}`,
    );
    await subtaskDialog.getByRole("button", { name: "Create Subtask" }).click();
    await expect(subtaskDialog).not.toBeVisible({ timeout: 20_000 });

    await expect(
      subTasks(page).getByText(`Follow up with choir ${suffix}`, { exact: true }),
    ).toBeVisible({
      timeout: 20_000,
    });
  });

  test("adds one-level replies inside a Task Comment card", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Activity Reply Church ${suffix}`,
      email: `activity-reply-${suffix}@example.com`,
      userName: "E2E Reply Owner",
    });

    const pane = await openTaskDetails(page, `Activity Reply Task ${suffix}`, "Worship");
    const commentBody = `Parent comment for reply ${suffix}`;
    const replyBody = `Nested one-level reply ${suffix}`;

    await pane.getByRole("textbox", { name: "Add a comment" }).fill(commentBody);
    await pane.getByRole("button", { exact: true, name: "Comment" }).click();

    const commentCard = activityFeed(page).getByRole("listitem").filter({ hasText: commentBody });
    await expect(commentCard).toBeVisible({ timeout: 20_000 });
    await commentCard.getByRole("button", { exact: true, name: "Reply" }).click();
    await commentCard.getByRole("textbox", { name: "Add a reply" }).fill(replyBody);
    await commentCard.getByRole("button", { exact: true, name: "Reply" }).click();

    await expect(
      commentCard.getByRole("list", { name: "Replies" }).getByText(replyBody),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(activityFeed(page).getByText("replied", { exact: false })).toHaveCount(0);

    await page.reload();
    const reloadedCard = activityFeed(page).getByRole("listitem").filter({ hasText: commentBody });
    await expect(
      reloadedCard.getByRole("list", { name: "Replies" }).getByText(replyBody),
    ).toBeVisible({
      timeout: 20_000,
    });
  });

  test("deep-links directly to root comments and replies", async ({ context, page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await startAuthenticatedSession(page, {
      churchName: `E2E Activity Deep Link Church ${suffix}`,
      email: `activity-deep-link-${suffix}@example.com`,
      userName: "E2E Deep Link Owner",
    });

    const pane = await openTaskDetails(page, `Activity Deep Link Task ${suffix}`, "Worship");
    const commentBody = `Root deep link comment ${suffix}`;
    const replyBody = `Reply deep link target ${suffix}`;

    await pane.getByRole("textbox", { name: "Add a comment" }).fill(commentBody);
    await pane.getByRole("button", { exact: true, name: "Comment" }).click();

    const commentCard = activityFeed(page).getByRole("listitem").filter({ hasText: commentBody });
    await expect(commentCard).toBeVisible({ timeout: 20_000 });

    await commentCard.getByRole("button", { exact: true, name: "Reply" }).click();
    await commentCard.getByRole("textbox", { name: "Add a reply" }).fill(replyBody);
    await commentCard.getByRole("button", { exact: true, name: "Reply" }).click();
    await expect(
      commentCard.getByRole("list", { name: "Replies" }).getByText(replyBody),
    ).toBeVisible({ timeout: 20_000 });

    await commentCard.hover();
    await commentCard.getByLabel("Comment actions").click();
    await page.getByRole("menuitem", { name: "Copy link" }).click();
    const commentLink = await page.evaluate(() => navigator.clipboard.readText());
    const commentFragment = new URL(commentLink).hash.slice(1);
    expect(commentFragment).toMatch(/^task-comment-/);

    await page.goto(commentLink);
    const linkedComment = page.locator(`[id="${commentFragment}"]`);
    await expect(linkedComment.getByText(commentBody)).toBeVisible({ timeout: 20_000 });
    await expect(linkedComment.locator("article")).toHaveClass(/ring-2/);

    const replyRow = linkedComment.getByRole("listitem").filter({ hasText: replyBody });
    await replyRow.hover();
    await replyRow.getByLabel("Reply actions").click();
    await page.getByRole("menuitem", { name: "Copy link" }).click();
    const replyLink = await page.evaluate(() => navigator.clipboard.readText());
    const replyFragment = new URL(replyLink).hash.slice(1);
    expect(replyFragment).toMatch(/^task-comment-/);
    expect(replyFragment).not.toBe(commentFragment);

    await page.goto(replyLink);
    const linkedReply = page.locator(`[id="${replyFragment}"]`);
    await expect(linkedReply.getByText(replyBody)).toBeVisible({ timeout: 20_000 });
    await expect(linkedReply).toHaveClass(/ring-2/);
  });

  test("edits and deletes Task Comments as visible tombstones", async ({ page }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.workerIndex}`;
    await startAuthenticatedSession(page, {
      churchName: `E2E Activity Moderate Church ${suffix}`,
      email: `activity-moderate-${suffix}@example.com`,
      userName: "E2E Moderate Owner",
    });

    const pane = await openTaskDetails(page, `Activity Moderate Task ${suffix}`, "Worship");
    const originalBody = `Original comment to edit ${suffix}`;
    const editedBody = `Edited comment body ${suffix}`;

    await pane.getByRole("textbox", { name: "Add a comment" }).fill(originalBody);
    await pane.getByRole("button", { exact: true, name: "Comment" }).click();

    const commentCard = activityFeed(page).getByRole("listitem").filter({ hasText: originalBody });
    await expect(commentCard).toBeVisible({ timeout: 20_000 });

    await commentCard.hover();
    await commentCard.getByLabel("Comment actions").click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    // While editing, the card swaps its body text for the edit composer, so the
    // `originalBody` filter no longer matches it. Scope to the pane's open edit
    // composer instead, which is unique while a single comment is being edited.
    await pane.getByRole("textbox", { name: "Edit comment" }).fill(editedBody);
    await pane.getByRole("button", { exact: true, name: "Save" }).click();

    await expect(activityFeed(page).getByText(editedBody)).toBeVisible({ timeout: 20_000 });
    await expect(activityFeed(page).getByText(originalBody)).not.toBeVisible();
    const editedCommentCard = activityFeed(page)
      .getByRole("listitem")
      .filter({ hasText: editedBody });
    await expect(editedCommentCard.getByText("(edited)")).toBeVisible();

    await editedCommentCard.hover();
    await editedCommentCard.getByLabel("Comment actions").click();
    await page.getByRole("menuitem", { name: /Delete/ }).click();
    await page.getByRole("button", { name: "Delete comment" }).click();

    await expect(activityFeed(page).getByText("This comment was deleted.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(activityFeed(page).getByText(editedBody)).not.toBeVisible();

    await page.reload();
    await expect(detailsPane(page)).toBeVisible();
    await expect(activityFeed(page).getByText("This comment was deleted.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(activityFeed(page).getByText(editedBody)).not.toBeVisible();
  });
});
