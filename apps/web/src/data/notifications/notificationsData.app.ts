import { mutators, queries, type Notification } from "@church-task/zero";
import { useQuery, useZero } from "@rocicorp/zero/react";

export type NotificationCollectionItem = Notification;

const NO_ACTIVE_CHURCH_ID = "__no_church__";

export function useNotificationsCollection(params: { readonly churchId: string | null }) {
  const [rows, result] = useQuery(
    queries.notifications.by_recipient({ church_id: params.churchId ?? NO_ACTIVE_CHURCH_ID }),
  );

  const collection = rows as readonly NotificationCollectionItem[];

  return {
    loading: params.churchId !== null && result.type !== "complete",
    collection,
    notificationsCollection: collection,
    unreadCount: collection.filter((notification) => notification.read_at == null).length,
  };
}

export function useMarkNotificationReadMutation() {
  const zero = useZero();

  return (params: { readonly churchId: string; readonly notificationId: string }) =>
    zero.mutate(
      mutators.notifications.mark_read({
        church_id: params.churchId,
        notification_id: params.notificationId,
      }),
    );
}

export function useMarkNotificationUnreadMutation() {
  const zero = useZero();

  return (params: { readonly churchId: string; readonly notificationId: string }) =>
    zero.mutate(
      mutators.notifications.mark_unread({
        church_id: params.churchId,
        notification_id: params.notificationId,
      }),
    );
}

export function useMarkAllNotificationsReadMutation() {
  const zero = useZero();

  return (params: { readonly churchId: string }) =>
    zero.mutate(mutators.notifications.mark_all_read({ church_id: params.churchId }));
}

export function useDeleteNotificationMutation() {
  const zero = useZero();

  return (params: { readonly churchId: string; readonly notificationId: string }) =>
    zero.mutate(
      mutators.notifications.delete({
        church_id: params.churchId,
        notification_id: params.notificationId,
      }),
    );
}

export function useDeleteReadNotificationsMutation() {
  const zero = useZero();

  return (params: { readonly churchId: string }) =>
    zero.mutate(mutators.notifications.delete_read({ church_id: params.churchId }));
}

export function useSnoozeNotificationMutation() {
  const zero = useZero();

  return (params: {
    readonly churchId: string;
    readonly notificationId: string;
    readonly snoozedUntil: Date;
  }) =>
    zero.mutate(
      mutators.notifications.snooze({
        church_id: params.churchId,
        notification_id: params.notificationId,
        snoozed_until: params.snoozedUntil.toISOString(),
      }),
    );
}
