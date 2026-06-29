"use client";

import * as React from "react";

import type { TElement } from "platejs";
import type { PlateEditor, PlateElementProps } from "platejs/react";

import { KEYS } from "platejs";
import { PlateElement } from "platejs/react";

import { UserAvatar } from "@/components/avatars/userAvatar";
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from "@/components/ui/inline-combobox";
import { getUserDisplayName } from "@/data/users/usersData.app";
import { useChurchUsersCollection } from "@/data/users/usersData.app";
import { useTasksCollection } from "@/data/tasks/tasksData.app";
import { useChurchId } from "@/data/useChurchId";

import type { MentionKind } from "./mention-node";

type MentionData = {
  kind: MentionKind;
  value: string;
  userId?: string;
  taskId?: string;
  taskIdentifier?: string;
  avatar?: string | null;
};

/**
 * Replace the `@`-trigger input node with a typed mention element. We build the
 * node by hand (rather than using the default `insert.mention`) so the stable
 * reference fields — `mentionKind`, `userId` / `taskId` — are persisted on the
 * node and can later be diffed into the mention graph.
 */
function insertTaskMention(editor: PlateEditor, data: MentionData) {
  const node: TElement = {
    type: KEYS.mention,
    value: data.value,
    mentionKind: data.kind,
    ...(data.userId ? { userId: data.userId } : {}),
    ...(data.taskId ? { taskId: data.taskId } : {}),
    ...(data.taskIdentifier ? { taskIdentifier: data.taskIdentifier } : {}),
    ...(data.avatar ? { avatar: data.avatar } : {}),
    children: [{ text: "" }],
  };

  editor.tf.insertNodes(node, { select: true });
  editor.tf.move({ unit: "offset" });
  editor.tf.insertText(" ");
}

export function MentionInputElement(props: PlateElementProps<TElement>) {
  const { editor, element } = props;
  const [search, setSearch] = React.useState("");

  const churchId = useChurchId();
  const { usersCollection } = useChurchUsersCollection({ churchId });
  const { tasksCollection } = useTasksCollection({
    churchId,
    currentUserId: null,
  });

  const taskItems = React.useMemo(
    () => tasksCollection.filter((task) => !task.isProjected),
    [tasksCollection],
  );

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox
        value={search}
        element={element}
        setValue={setSearch}
        showTrigger={false}
        trigger="@"
      >
        <span
          data-combobox-anchor
          className="-my-0.5 inline-block rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm ring-ring focus-within:ring-2"
        >
          @<InlineComboboxInput />
        </span>

        <InlineComboboxContent>
          <InlineComboboxEmpty>No results</InlineComboboxEmpty>

          <InlineComboboxGroup>
            <InlineComboboxGroupLabel>Users</InlineComboboxGroupLabel>

            {usersCollection.map((user) => {
              const label = getUserDisplayName(user);

              return (
                <InlineComboboxItem
                  key={user.id}
                  value={label}
                  keywords={[user.email ?? ""]}
                  onClick={() =>
                    insertTaskMention(editor, {
                      kind: "user",
                      value: label,
                      userId: user.id,
                      avatar: user.image ?? null,
                    })
                  }
                >
                  <UserAvatar
                    userId={user.id}
                    name={label}
                    avatar={user.image ?? null}
                    size={20}
                    className="mr-2"
                  />
                  {label}
                </InlineComboboxItem>
              );
            })}
          </InlineComboboxGroup>

          <InlineComboboxGroup>
            <InlineComboboxGroupLabel>Issues</InlineComboboxGroupLabel>

            {taskItems.map((task) => (
              <InlineComboboxItem
                key={task.id}
                value={`${task.identifier} ${task.title}`}
                keywords={[task.identifier, task.title]}
                onClick={() =>
                  insertTaskMention(editor, {
                    kind: "task",
                    value: task.title,
                    taskId: task.id,
                    taskIdentifier: task.identifier,
                  })
                }
              >
                <span className="mr-2 font-mono text-muted-foreground text-xs">
                  {task.identifier}
                </span>
                <span className="truncate">{task.title}</span>
              </InlineComboboxItem>
            ))}
          </InlineComboboxGroup>
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
