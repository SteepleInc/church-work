"use client";

import { Data } from "effect";
import { atom } from "jotai";

/**
 * The shape of Template being authored. Mirrors the authoring surfaces in
 * `template-authoring.tsx`: a weekly service Cycle, a period Cycle (monthly /
 * quarterly / yearly), or a Key Date anchored Template.
 */
export type TemplateBigActionShape =
  | "weekly_service"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "key_date";

/**
 * State for the create-Template big action. `closed` hides the big action;
 * `create` opens it on a given authoring shape and step. The step index drives
 * which screen of the stepper is visible (0-based).
 */
export type TemplateBigActionState = Data.TaggedEnum<{
  closed: {};
  create: { shape: TemplateBigActionShape; step: number };
}>;

export const TemplateBigActionState = Data.taggedEnum<TemplateBigActionState>();

export type TemplateBigActionClosed = Data.TaggedEnum.Value<TemplateBigActionState, "closed">;

export type TemplateBigActionCreate = Data.TaggedEnum.Value<TemplateBigActionState, "create">;

export const templateBigActionStateAtom = atom<TemplateBigActionState>(
  TemplateBigActionState.closed(),
);
