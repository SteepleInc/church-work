import { startPostgresHarness } from "@church-work/test-harness";
import { mustGetMutator } from "@rocicorp/zero";
import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import {
  activities,
  member,
  notifications,
  task_mentions,
  tasks,
  teams,
  workflow_statuses,
  workflows,
} from "@church-work/db/schema";

import { mutators } from "./mutators";

const now = new Date("2026-01-01T00:00:00.000Z");
const churchId = "org_mentions";
const actorId = "user_actor";
const mentionedId = "user_mentioned";

const sessionContext = {
  active_church_id: churchId,
  authenticated: true,
  church_role: "owner",
  is_app_admin: false,
  runtime: "server",
  session_id: "session_mentions",
  user_id: actorId,
} as const;

const baseEntity = (tag: string) => ({
  _tag: tag,
  created_at: now,
  created_by: actorId,
  updated_at: now,
  updated_by: actorId,
});

const mentionParagraph = (mentionNode: Record<string, unknown>) =>
  JSON.stringify([
    {
      type: "p",
      children: [{ text: "Hey " }, mentionNode, { text: "!" }],
    },
  ]);

const userMentionDoc = () =>
  mentionParagraph({
    type: "mention",
    mentionKind: "user",
    userId: mentionedId,
    value: "Mentioned",
    children: [{ text: "" }],
  });

const taskMentionDoc = (targetTaskId: string) =>
  mentionParagraph({
    type: "mention",
    mentionKind: "task",
    taskId: targetTaskId,
    value: "MEN-1",
    children: [{ text: "" }],
  });

const seedChurch = async (db: Awaited<ReturnType<typeof startPostgresHarness>>["db"]) => {
  await db.insert(teams).values({
    ...baseEntity("team"),
    church_id: churchId,
    color: "blue",
    id: "team_mentions",
    identifier: "MEN",
    name: "Mentions",
    next_task_number: 1,
    previous_identifiers: "[]",
    sort_order: 0,
  });
  await db.insert(workflows).values({
    ...baseEntity("workflow"),
    church_id: churchId,
    id: "workflow_mentions",
    name: "Mentions Workflow",
    team_id: "team_mentions",
  });
  await db.insert(workflow_statuses).values({
    ...baseEntity("workflowstatus"),
    church_id: churchId,
    id: "workflowstatus_todo_mentions",
    key: "todo",
    name: "To Do",
    sort_order: 0,
    task_state: "todo",
    workflow_id: "workflow_mentions",
  });
  await db.insert(member).values([
    {
      _tag: "orguser",
      id: "member_actor",
      organizationId: churchId,
      role: "owner",
      userId: actorId,
    },
    {
      _tag: "orguser",
      id: "member_mentioned",
      organizationId: churchId,
      role: "member",
      userId: mentionedId,
    },
  ]);
};

describe("Task description mention graph integration", () => {
  test("syncs the mention graph and notifies newly-mentioned users", async () => {
    const harness = await startPostgresHarness();
    const { db } = harness;

    try {
      await seedChurch(db);

      const tx = { dbTransaction: { wrappedTransaction: db }, location: "server" } as never;

      await mustGetMutator(mutators, "tasks.create").fn({
        args: {
          church_id: churchId,
          team_id: "team_mentions",
          title: "Mentions task",
          description: userMentionDoc(),
          workflow_status_id: "workflowstatus_todo_mentions",
        },
        ctx: sessionContext,
        tx,
      });

      const createdTasks = await db.select().from(tasks).where(eq(tasks.church_id, churchId));
      expect(createdTasks).toHaveLength(1);
      const taskId = createdTasks[0]!.id;

      // One live user edge.
      const edgesAfterCreate = await db
        .select()
        .from(task_mentions)
        .where(and(eq(task_mentions.source_task_id, taskId), isNull(task_mentions.deleted_at)));
      expect(edgesAfterCreate).toHaveLength(1);
      expect(edgesAfterCreate[0]).toMatchObject({
        mention_kind: "user",
        target_user_id: mentionedId,
        target_task_id: null,
      });

      // One inbox notification for the mentioned user (not the actor).
      const notificationsAfterCreate = await db
        .select()
        .from(notifications)
        .where(eq(notifications.church_id, churchId));
      expect(notificationsAfterCreate).toHaveLength(1);
      expect(notificationsAfterCreate[0]).toMatchObject({
        recipient_user_id: mentionedId,
        type: "mention_explicit_target",
        task_id: taskId,
      });

      // Re-saving the same description must not duplicate the notification.
      await mustGetMutator(mutators, "tasks.update").fn({
        args: {
          church_id: churchId,
          task_id: taskId,
          fields: { description: userMentionDoc() },
        },
        ctx: sessionContext,
        tx,
      });
      const notificationsAfterResave = await db
        .select()
        .from(notifications)
        .where(eq(notifications.church_id, churchId));
      expect(notificationsAfterResave).toHaveLength(1);
      const liveEdgesAfterResave = await db
        .select()
        .from(task_mentions)
        .where(and(eq(task_mentions.source_task_id, taskId), isNull(task_mentions.deleted_at)));
      expect(liveEdgesAfterResave).toHaveLength(1);

      // Removing the mention soft-deletes the edge.
      await mustGetMutator(mutators, "tasks.update").fn({
        args: {
          church_id: churchId,
          task_id: taskId,
          fields: {
            description: JSON.stringify([{ type: "p", children: [{ text: "No mentions" }] }]),
          },
        },
        ctx: sessionContext,
        tx,
      });
      const liveEdgesAfterRemoval = await db
        .select()
        .from(task_mentions)
        .where(and(eq(task_mentions.source_task_id, taskId), isNull(task_mentions.deleted_at)));
      expect(liveEdgesAfterRemoval).toHaveLength(0);

      // Re-adding the same mention revives the edge and notifies again (a fresh
      // mention after removal is a genuinely new mention).
      await mustGetMutator(mutators, "tasks.update").fn({
        args: {
          church_id: churchId,
          task_id: taskId,
          fields: { description: userMentionDoc() },
        },
        ctx: sessionContext,
        tx,
      });
      const liveEdgesAfterReadd = await db
        .select()
        .from(task_mentions)
        .where(and(eq(task_mentions.source_task_id, taskId), isNull(task_mentions.deleted_at)));
      expect(liveEdgesAfterReadd).toHaveLength(1);
      const notificationsAfterReadd = await db
        .select()
        .from(notifications)
        .where(eq(notifications.church_id, churchId));
      expect(notificationsAfterReadd).toHaveLength(2);
    } finally {
      await harness.stop();
    }
  }, 60_000);

  test("logs a task→task backlink activity on the mentioned Task", async () => {
    const harness = await startPostgresHarness();
    const { db } = harness;

    try {
      await seedChurch(db);

      const tx = { dbTransaction: { wrappedTransaction: db }, location: "server" } as never;

      // Target Task that will be mentioned.
      await mustGetMutator(mutators, "tasks.create").fn({
        args: {
          church_id: churchId,
          team_id: "team_mentions",
          title: "Target task",
          workflow_status_id: "workflowstatus_todo_mentions",
        },
        ctx: sessionContext,
        tx,
      });
      const targetTask = (await db.select().from(tasks).where(eq(tasks.church_id, churchId)))[0]!;

      // Source Task whose description mentions the target.
      await mustGetMutator(mutators, "tasks.create").fn({
        args: {
          church_id: churchId,
          team_id: "team_mentions",
          title: "Source task",
          description: taskMentionDoc(targetTask.id),
          workflow_status_id: "workflowstatus_todo_mentions",
        },
        ctx: sessionContext,
        tx,
      });
      const sourceTask = (await db.select().from(tasks).where(eq(tasks.title, "Source task")))[0]!;

      // One live task→task edge from source to target.
      const edges = await db
        .select()
        .from(task_mentions)
        .where(
          and(eq(task_mentions.source_task_id, sourceTask.id), isNull(task_mentions.deleted_at)),
        );
      expect(edges).toHaveLength(1);
      expect(edges[0]).toMatchObject({
        mention_kind: "task",
        target_task_id: targetTask.id,
        target_user_id: null,
      });

      // A backlink activity lives on the TARGET Task's feed, snapshotting the
      // source Task so the "mentioned in" UI can render and link it.
      const backlinkActivities = await db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.entity_id, targetTask.id),
            eq(activities.event_type, "task.mentioned_in"),
          ),
        );
      expect(backlinkActivities).toHaveLength(1);
      const metadata = JSON.parse(backlinkActivities[0]!.metadata) as {
        source?: { id?: string; identifier?: string; label?: string };
      };
      expect(metadata.source?.id).toBe(sourceTask.id);
      expect(metadata.source?.label).toBe("Source task");

      // A task mention is not a user mention, so no inbox notification fires.
      const notificationRows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.church_id, churchId));
      expect(notificationRows).toHaveLength(0);

      // Re-saving the same description must not log a duplicate backlink.
      await mustGetMutator(mutators, "tasks.update").fn({
        args: {
          church_id: churchId,
          task_id: sourceTask.id,
          fields: { description: taskMentionDoc(targetTask.id) },
        },
        ctx: sessionContext,
        tx,
      });
      const backlinkActivitiesAfterResave = await db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.entity_id, targetTask.id),
            eq(activities.event_type, "task.mentioned_in"),
          ),
        );
      expect(backlinkActivitiesAfterResave).toHaveLength(1);
    } finally {
      await harness.stop();
    }
  }, 60_000);
});
