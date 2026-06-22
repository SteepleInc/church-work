export type NotificationTriggerType = "task_comment_reply" | "mention_explicit_target";

export type NotificationPlanInput = {
  readonly actor_user_id: string;
  readonly church_id: string;
  readonly type: NotificationTriggerType;
  readonly task_id?: string | null;
  readonly task_identifier?: string | null;
  readonly task_title?: string | null;
  readonly activity_id?: string | null;
  readonly task_comment_id?: string | null;
  readonly task_comment_thread_id?: string | null;
  readonly comment_excerpt?: string | null;
  readonly subscribed_user_ids?: readonly string[];
  readonly explicit_target_user_ids?: readonly string[];
  readonly active_member_user_ids: readonly string[];
};

export type PlannedNotification = {
  readonly recipient_user_id: string;
  readonly type: NotificationTriggerType;
  readonly idempotency_key: string;
  readonly activity_id: string | null;
  readonly task_id: string | null;
  readonly task_comment_id: string | null;
  readonly task_comment_thread_id: string | null;
  readonly actor_user_id: string;
  readonly display_title: string;
  readonly display_body: string | null;
  readonly display_metadata: Record<string, string>;
};

const unique = (values: readonly string[]) => [...new Set(values.filter(Boolean))];

const excerpt = (body: string | null | undefined) => {
  const normalized = (body ?? "").trim().replaceAll(/\s+/g, " ");
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized || null;
};

const recipientsForTrigger = (input: NotificationPlanInput) =>
  input.type === "mention_explicit_target"
    ? (input.explicit_target_user_ids ?? [])
    : (input.subscribed_user_ids ?? []);

export const buildNotificationPlans = (
  input: NotificationPlanInput,
): readonly PlannedNotification[] => {
  const activeMembers = new Set(input.active_member_user_ids);
  const commentExcerpt = excerpt(input.comment_excerpt);
  const titleSubject = input.task_identifier
    ? `${input.task_identifier}${input.task_title ? ` ${input.task_title}` : ""}`
    : (input.task_title ?? "Task");

  return unique(recipientsForTrigger(input))
    .filter((recipient_user_id) => recipient_user_id !== input.actor_user_id)
    .filter((recipient_user_id) => activeMembers.has(recipient_user_id))
    .map((recipient_user_id) => ({
      activity_id: input.activity_id ?? null,
      actor_user_id: input.actor_user_id,
      display_body: commentExcerpt,
      display_metadata: {
        ...(input.task_identifier ? { task_identifier: input.task_identifier } : {}),
        ...(input.task_title ? { task_title: input.task_title } : {}),
        ...(commentExcerpt ? { comment_excerpt: commentExcerpt } : {}),
      },
      display_title:
        input.type === "mention_explicit_target"
          ? `Mentioned you on ${titleSubject}`
          : `New reply on ${titleSubject}`,
      idempotency_key: [
        input.type,
        input.church_id,
        input.task_comment_thread_id ?? "no-thread",
        input.task_comment_id ?? input.activity_id ?? "no-event",
        recipient_user_id,
      ].join(":"),
      recipient_user_id,
      task_comment_id: input.task_comment_id ?? null,
      task_comment_thread_id: input.task_comment_thread_id ?? null,
      task_id: input.task_id ?? null,
      type: input.type,
    }));
};
