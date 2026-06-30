"use client";

import { BasicNodesKit } from "@/components/editor/plugins/basic-nodes-kit";
import { CodeBlockKit } from "@/components/editor/plugins/code-block-kit";
import { ListKit } from "@/components/editor/plugins/list-kit";
import { MentionKit } from "@/components/editor/plugins/mention-kit";
import { SlashKit } from "@/components/editor/plugins/slash-kit";

/**
 * The plugin set used by task descriptions: Linear-style chromeless editing
 * (markdown shortcuts + `/` slash menu + `@` mentions), no toolbar.
 */
export const DescriptionKit = [
  ...BasicNodesKit,
  ...ListKit,
  ...CodeBlockKit,
  ...MentionKit,
  ...SlashKit,
];
