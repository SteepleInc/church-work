import * as React from "react";

import type { SlateElementProps } from "platejs/static";

import { KEYS } from "platejs";
import { SlateElement } from "platejs/static";

import { cn } from "@/lib/utils";

import type { TTaskMentionElement } from "./mention-node";

export function MentionElementStatic(
  props: SlateElementProps<TTaskMentionElement> & {
    prefix?: string;
  },
) {
  const { prefix } = props;
  const element = props.element;
  const isTask = element.mentionKind === "task";

  return (
    <SlateElement
      {...props}
      as="span"
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 align-baseline font-medium text-sm",
        element.children[0][KEYS.bold] === true && "font-bold",
        element.children[0][KEYS.italic] === true && "italic",
        element.children[0][KEYS.underline] === true && "underline",
      )}
      attributes={{
        ...props.attributes,
        "data-slate-value": element.value,
      }}
    >
      {isTask && element.taskIdentifier ? (
        <span className="font-mono text-muted-foreground text-xs">{element.taskIdentifier}</span>
      ) : null}
      {props.children}
      {!isTask ? prefix : null}
      {element.value}
    </SlateElement>
  );
}
