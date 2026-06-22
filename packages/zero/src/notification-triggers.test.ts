import { describe, expect, test } from "vitest";
import { buildNotificationPlans } from "./notification-triggers";

describe("notification trigger planning", () => {
  test("plans comment reply notifications with self suppression, membership filtering, metadata, and idempotency", () => {
    const plans = buildNotificationPlans({
      active_member_user_ids: ["user_actor", "user_subscriber", "user_duplicate"],
      actor_user_id: "user_actor",
      church_id: "org_test",
      comment_excerpt: "  Reply body\nwith context  ",
      subscribed_user_ids: [
        "user_actor",
        "user_subscriber",
        "user_non_member",
        "user_duplicate",
        "user_duplicate",
      ],
      task_comment_id: "taskcomment_reply",
      task_comment_thread_id: "taskcomment_root",
      task_id: "task_test",
      task_identifier: "PRO-7",
      task_title: "Prepare stage cues",
      type: "task_comment_reply",
    });

    expect(plans.map((plan) => plan.recipient_user_id)).toEqual([
      "user_subscriber",
      "user_duplicate",
    ]);
    expect(plans[0]).toMatchObject({
      display_body: "Reply body with context",
      display_metadata: {
        comment_excerpt: "Reply body with context",
        task_identifier: "PRO-7",
        task_title: "Prepare stage cues",
      },
      display_title: "New reply on PRO-7 Prepare stage cues",
      idempotency_key:
        "task_comment_reply:org_test:taskcomment_root:taskcomment_reply:user_subscriber",
      task_comment_id: "taskcomment_reply",
      task_comment_thread_id: "taskcomment_root",
    });
  });

  test("represents mentions as explicit-target planning only", () => {
    expect(
      buildNotificationPlans({
        active_member_user_ids: ["user_target"],
        actor_user_id: "user_actor",
        church_id: "org_test",
        explicit_target_user_ids: ["user_target"],
        task_id: "task_test",
        type: "mention_explicit_target",
      }),
    ).toHaveLength(1);
  });
});
