import { Schema } from "effect";

export const DetailsPaneTask = Schema.Struct({
  _tag: Schema.Literal("task"),
  id: Schema.String,
  tab: Schema.Literal("details"),
});
export type DetailsPaneTask = typeof DetailsPaneTask.Type;

export const DetailsPaneTeam = Schema.Struct({
  _tag: Schema.Literal("team"),
  id: Schema.String,
  tab: Schema.Literal("details"),
});
export type DetailsPaneTeam = typeof DetailsPaneTeam.Type;

export const DetailsPaneOrg = Schema.Struct({
  _tag: Schema.Literal("org"),
  id: Schema.String,
  tab: Schema.Literal("details"),
});
export type DetailsPaneOrg = typeof DetailsPaneOrg.Type;

export const DetailsPaneUser = Schema.Struct({
  _tag: Schema.Literal("user"),
  id: Schema.String,
  tab: Schema.Literal("details"),
});
export type DetailsPaneUser = typeof DetailsPaneUser.Type;

export const DetailsPaneUnion = Schema.Union(
  DetailsPaneTask,
  DetailsPaneTeam,
  DetailsPaneOrg,
  DetailsPaneUser,
);
export type DetailsPaneUnion = typeof DetailsPaneUnion.Type;

export const DetailsPaneParams = Schema.Array(DetailsPaneUnion);
export type DetailsPaneParams = typeof DetailsPaneParams.Type;

export type DetailsPaneSearch = {
  readonly "details-pane"?: DetailsPaneParams;
};
