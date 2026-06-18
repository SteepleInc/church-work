import { expect, type Page, test } from "@playwright/test";

import { startAuthenticatedSession } from "./helpers";

test.skip(
  process.env.CHURCH_TASK_E2E_ONBOARDING_STACK !== "1",
  "Run with bun run test:e2e:labels to boot the local Postgres/Zero onboarding stack.",
);

test.setTimeout(120_000);

async function createTask(page: Page, title: string, options: { readonly team?: string } = {}) {
  await page.getByRole("main").getByRole("button", { name: "Create Task" }).click();
  const dialog = page.getByRole("dialog", { name: /New Task/ });
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("Task title").fill(title);

  if (options.team) {
    await dialog.getByLabel("Team").click();
    await page.getByRole("option", { name: options.team }).click();
  }

  await dialog.getByRole("button", { name: "Create Task" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 20_000 });
}

test("manages Labels and applies them to Tasks on the local Postgres and Zero stack", async ({
  page,
}, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `labels-${suffix}@example.com`;
  const labelName = `Follow Up ${suffix}`;
  const taskTitle = `Labelled Task ${suffix}`;

  await startAuthenticatedSession(page, {
    churchName: `E2E Labels Church ${suffix}`,
    email,
    userName: "E2E Labels Owner",
  });

  await page.goto("/settings/workspace/labels");
  await expect(page.getByRole("heading", { name: "Labels" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "New label" }).click();
  await page.getByPlaceholder("Label name").fill(labelName);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("row", { name: new RegExp(`${labelName}.*—`) })).toBeVisible({
    timeout: 20_000,
  });

  await page.reload();
  await expect(page.getByRole("row", { name: new RegExp(`${labelName}.*—`) })).toBeVisible({
    timeout: 20_000,
  });

  // Our Work shows every Task regardless of Week — no Week scope control — so
  // the freshly created Task is visible without an "All" scope toggle.
  await page.goto("/our-work");
  await expect(page).toHaveURL(/\/our-work$/);
  await createTask(page, taskTitle, { team: "Worship" });

  const taskCard = page.getByLabel(`Task card ${taskTitle}`);
  await expect(taskCard).toBeVisible({ timeout: 20_000 });
  await taskCard.click();

  const detailsPane = page.getByRole("dialog", { name: "Details Pane" });
  await expect(detailsPane).toBeVisible();
  await detailsPane.getByLabel("Add labels").click();
  await page.getByRole("option", { name: labelName }).click();
  await expect(detailsPane.getByText(labelName)).toBeVisible({ timeout: 20_000 });

  await page.goto("/settings/workspace/labels");
  await expect(page.getByRole("row", { name: new RegExp(`${labelName}.*1`) })).toBeVisible({
    timeout: 20_000,
  });
});
