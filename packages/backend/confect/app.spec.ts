import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

import {
  ListActivitiesForEntityArgs,
  ListActivitiesForEntityResponse,
  RecordActivityArgs,
  RecordActivityOperationResponse,
} from "../agent/activityOperations";
import {
  KeyDateCreateArgs,
  KeyDateListArgs,
  KeyDateOccurrenceCreateArgs,
  KeyDateReadResponse,
  KeyDateResolveOccurrencesArgs,
  KeyDateWriteResponse,
} from "../agent/keyDateOperations";
import {
  ActiveChurchArgs,
  ActiveChurchResponse,
  BatchReadArgs,
  BatchReadResponse,
  CurrentUserResponse,
} from "../agent/operations";
import {
  TeamListArgs,
  TeamProductUpdateArgs,
  TeamReadResponse,
  TeamWriteResponse,
} from "../agent/teamOperations";
import {
  TemplateCreateArgs,
  TemplateReadResponse,
  TemplateResolveSchedulesArgs,
  TemplateWriteResponse,
} from "../agent/templateOperations";
import {
  TaskCreateBatchArgs,
  TaskListArgs,
  TaskReadResponse,
  TaskWriteResponse,
} from "../agent/taskOperations";
import { WorkDefaultsChurchArgs, WorkDefaultsResponse } from "../agent/workDefaultsOperations";
import {
  WorkflowArchiveStatusArgs,
  WorkflowCreateArgs,
  WorkflowRemapTaskTeamArgs,
  WorkflowWriteResponse,
} from "../agent/workflowOperations";

export const healthCheck = GroupSpec.make("healthCheck").addFunction(
  FunctionSpec.publicQuery({
    name: "get",
    args: Schema.Struct({}),
    returns: Schema.Literal("OK"),
  }),
);

export const privateData = GroupSpec.make("privateData").addFunction(
  FunctionSpec.publicQuery({
    name: "get",
    args: Schema.Struct({}),
    returns: Schema.Struct({ message: Schema.String }),
  }),
);

export const auth = GroupSpec.make("auth").addFunction(
  FunctionSpec.publicQuery({
    name: "getCurrentUser",
    args: Schema.Struct({}),
    returns: Schema.Any,
  }),
);

export const agent = GroupSpec.make("agent")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "currentUser",
      args: Schema.Struct({}),
      returns: CurrentUserResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "batchRead",
      args: BatchReadArgs,
      returns: BatchReadResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "activeChurch",
      args: ActiveChurchArgs,
      returns: ActiveChurchResponse,
    }),
  );

export const workDefaults = GroupSpec.make("workDefaults")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "seedForChurch",
      args: WorkDefaultsChurchArgs,
      returns: WorkDefaultsResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "readForChurch",
      args: WorkDefaultsChurchArgs,
      returns: WorkDefaultsResponse,
    }),
  );

export const keyDates = GroupSpec.make("keyDates")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createForChurch",
      args: KeyDateCreateArgs,
      returns: KeyDateWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createOccurrences",
      args: KeyDateOccurrenceCreateArgs,
      returns: KeyDateWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listForChurch",
      args: KeyDateListArgs,
      returns: KeyDateReadResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "resolveOccurrences",
      args: KeyDateResolveOccurrencesArgs,
      returns: KeyDateReadResponse,
    }),
  );

export const activities = GroupSpec.make("activities")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "recordForChurch",
      args: RecordActivityArgs,
      returns: RecordActivityOperationResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listForEntity",
      args: ListActivitiesForEntityArgs,
      returns: ListActivitiesForEntityResponse,
    }),
  );

export const teams = GroupSpec.make("teams")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listForChurch",
      args: TeamListArgs,
      returns: TeamReadResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateProductFields",
      args: TeamProductUpdateArgs,
      returns: TeamWriteResponse,
    }),
  );

export const tasks = GroupSpec.make("tasks")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createBatch",
      args: TaskCreateBatchArgs,
      returns: TaskWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listForChurch",
      args: TaskListArgs,
      returns: TaskReadResponse,
    }),
  );

export const workflows = GroupSpec.make("workflows")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createForChurch",
      args: WorkflowCreateArgs,
      returns: WorkflowWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "archiveStatus",
      args: WorkflowArchiveStatusArgs,
      returns: WorkflowWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "remapTaskTeam",
      args: WorkflowRemapTaskTeamArgs,
      returns: WorkflowWriteResponse,
    }),
  );

export const templates = GroupSpec.make("templates")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createForChurch",
      args: TemplateCreateArgs,
      returns: TemplateWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "resolveSchedules",
      args: TemplateResolveSchedulesArgs,
      returns: TemplateReadResponse,
    }),
  );
