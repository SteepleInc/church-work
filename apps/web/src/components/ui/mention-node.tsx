"use client";

import * as React from "react";

import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";

import { IS_APPLE, KEYS } from "platejs";
import { PlateElement, useFocused, useReadOnly, useSelected } from "platejs/react";

import { UserAvatar } from "@/components/avatars/userAvatar";
import { useMounted } from "@/components/editor/use-mounted";
import { cn } from "@/lib/utils";

export type MentionKind = "user" | "task";

/**
 * A mention element carries the human-readable display text in `value` plus a
 * stable typed reference (`mentionKind` + `userId` / `taskId`). The reference is
 * the source of truth for the mention graph; `value` is only a cached label so
 * the pill still reads sensibly before live data resolves.
 */
export type TTaskMentionElement = TElement & {
  value: string;
  mentionKind?: MentionKind;
  userId?: string;
  taskId?: string;
  taskIdentifier?: string;
  avatar?: string | null;
};

export function MentionElement(
  props: PlateElementProps<TTaskMentionElement> & {
    prefix?: string;
  },
) {
  const { element } = props;
  const selected = useSelected();
  const focused = useFocused();
  const mounted = useMounted();
  const readOnly = useReadOnly();

  const isUser = element.mentionKind === "user";
  const isTask = element.mentionKind === "task";

  return (
    <PlateElement
      {...props}
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 align-baseline font-medium text-sm",
        !readOnly && "cursor-pointer",
        selected && focused && "ring-2 ring-ring",
        element.children[0][KEYS.bold] === true && "font-bold",
        element.children[0][KEYS.italic] === true && "italic",
        element.children[0][KEYS.underline] === true && "underline",
      )}
      attributes={{
        ...props.attributes,
        contentEditable: false,
        "data-slate-value": element.value,
        draggable: true,
      }}
    >
      {isUser && element.userId ? (
        <UserAvatar
          userId={element.userId}
          name={element.value}
          avatar={element.avatar ?? null}
          size={16}
        />
      ) : null}
      {isTask && element.taskIdentifier ? (
        <span className="font-mono text-muted-foreground text-xs">{element.taskIdentifier}</span>
      ) : null}
      {mounted && IS_APPLE ? (
        // Mac OS IME https://github.com/ianstormtaylor/slate/issues/3490
        <>
          {props.children}
          {!isTask ? props.prefix : null}
          {element.value}
        </>
      ) : (
        // Others like Android https://github.com/ianstormtaylor/slate/pull/5360
        <>
          {!isTask ? props.prefix : null}
          {element.value}
          {props.children}
        </>
      )}
    </PlateElement>
  );
}
