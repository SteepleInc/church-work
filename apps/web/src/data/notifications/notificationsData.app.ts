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
