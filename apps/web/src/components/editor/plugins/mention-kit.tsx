"use client";

import { MentionInputPlugin, MentionPlugin } from "@platejs/mention/react";

import { MentionInputElement } from "@/components/ui/mention-input-node";
import { MentionElement } from "@/components/ui/mention-node";

export const MentionKit = [
  MentionPlugin.configure({
    options: {
      trigger: "@",
      triggerPreviousCharPattern: /^$|^[\s"']$/,
    },
  }).withComponent(MentionElement),
  MentionInputPlugin.withComponent(MentionInputElement),
];
