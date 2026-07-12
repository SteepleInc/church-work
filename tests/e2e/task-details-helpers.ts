import { expect, type Page } from "@playwright/test";

export const taskDetailsPane = (page: Page) => page.getByRole("dialog", { name: "Details Pane" });

export async function createTaskForTeam(page: Page, title: string, team: string) {
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

export async function createTaskAndOpenDetails(page: Page, title: string, team: string) {
  await createTaskForTeam(page, title, team);
  const card = page.getByLabel(`Task card ${title}`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.click();

  const pane = taskDetailsPane(page);
  await expect(pane).toBeVisible();
  await expect(pane.getByRole("textbox", { name: "Task title" })).toHaveValue(title);
  return pane;
}
