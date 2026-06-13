import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

import {
  ListActivitiesForEntityArgs,
  ListActivitiesForEntityResponse,
  RecordActivityArgs,
  RecordActivityOperationResponse,
} from "../agent/activityOperations";
import {
  ChurchSettingsArgs,
  ChurchSettingsReadResponse,
  ChurchSettingsWriteResponse,
  ChurchTimeZoneUpdateArgs,
} from "../agent/churchSettingsOperations";
import {
  CycleMaintenanceRunArgs,
  CycleMaintenanceWriteResponse,
} from "../agent/cycleMaintenanceOperations";
import {
  CoreWorkBatchReadArgs,
  CoreWorkBatchReadResponse,
  CoreWorkBatchWriteArgs,
  CoreWorkBatchWriteResponse,
} from "../agent/coreWorkOperations";
import {
  KeyDateCreateArgs,
  KeyDateListArgs,
  KeyDateOccurrenceCreateArgs,
  KeyDateReadResponse,
  KeyDateResolveOccurrencesArgs,
  KeyDateWriteResponse,
} from "../agent/keyDateOperations";
import {
  LabelCreateArgs,
  LabelDeleteArgs,
  LabelListArgs,
  LabelReadResponse,
  LabelUpdateArgs,
  LabelWriteResponse,
} from "../agent/labelOperations";
import {
  ActiveChurchArgs,
  ActiveChurchResponse,
  BatchReadArgs,
  BatchReadResponse,
  CurrentUserResponse,
} from "../agent/operations";
import {
  TeamArchiveArgs,
  TeamCreateArgs,
  TeamDeleteArgs,
  TeamListArgs,
  TeamMembershipArgs,
  TeamProductUpdateArgs,
  TeamRenameArgs,
  TeamReorderArgs,
  TeamReadResponse,
  TeamWriteResponse,
} from "../agent/teamOperations";
import {
  TemplateCreateArgs,
  TemplateMaterializeProjectedTasksArgs,
  TemplatePreviewCycleAdjustmentMergeArgs,
  TemplateReadResponse,
  TemplateResolveSchedulesArgs,
  TemplateSetCycleAdjustmentsArgs,
  TemplateUpdateTasksArgs,
  TemplateWriteResponse,
} from "../agent/templateOperations";
import {
  TaskCreateBatchArgs,
  TaskListArgs,
  TaskReadResponse,
  TaskTransitionBatchArgs,
  TaskUpdateBatchArgs,
  TaskWriteResponse,
} from "../agent/taskOperations";
import { WorkDefaultsChurchArgs, WorkDefaultsResponse } from "../agent/workDefaultsOperations";
import {
  WorkflowArchiveArgs,
  WorkflowArchiveStatusArgs,
  WorkflowAddStatusArgs,
  WorkflowCreateArgs,
  WorkflowRenameArgs,
  WorkflowRenameStatusArgs,
  WorkflowRemapTaskTeamArgs,
  WorkflowReorderArgs,
  WorkflowReorderStatusesArgs,
  WorkflowSetDefaultArgs,
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

export const cycleMaintenance = GroupSpec.make("cycleMaintenance").addFunction(
  FunctionSpec.publicMutation({
    name: "runForChurch",
    args: CycleMaintenanceRunArgs,
    returns: CycleMaintenanceWriteResponse,
  }),
);

export const churchSettings = GroupSpec.make("churchSettings")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "readForChurch",
      args: ChurchSettingsArgs,
      returns: ChurchSettingsReadResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateTimeZone",
      args: ChurchTimeZoneUpdateArgs,
      returns: ChurchSettingsWriteResponse,
    }),
  );

export const coreWork = GroupSpec.make("coreWork")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "batchRead",
      args: CoreWorkBatchReadArgs,
      returns: CoreWorkBatchReadResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "batchWrite",
      args: CoreWorkBatchWriteArgs,
      returns: CoreWorkBatchWriteResponse,
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

// Labels are open to every Church member — create, rename, recolor, and
// delete are deliberately not role-gated (see CONTEXT.md "Label").
export const labels = GroupSpec.make("labels")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "listForChurch",
      args: LabelListArgs,
      returns: LabelReadResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createForChurch",
      args: LabelCreateArgs,
      returns: LabelWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateForChurch",
      args: LabelUpdateArgs,
      returns: LabelWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteForChurch",
      args: LabelDeleteArgs,
      returns: LabelWriteResponse,
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
    FunctionSpec.publicQuery({
      name: "listMembershipsForChurch",
      args: TeamListArgs,
      returns: TeamReadResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createForChurch",
      args: TeamCreateArgs,
      returns: TeamWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "renameForChurch",
      args: TeamRenameArgs,
      returns: TeamWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "archiveForChurch",
      args: TeamArchiveArgs,
      returns: TeamWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "deleteForChurch",
      args: TeamDeleteArgs,
      returns: TeamWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reorderForChurch",
      args: TeamReorderArgs,
      returns: TeamWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "addMemberForChurch",
      args: TeamMembershipArgs,
      returns: TeamWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "removeMemberForChurch",
      args: TeamMembershipArgs,
      returns: TeamWriteResponse,
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
    FunctionSpec.publicMutation({
      name: "updateBatch",
      args: TaskUpdateBatchArgs,
      returns: TaskWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "completeBatch",
      args: TaskTransitionBatchArgs,
      returns: TaskWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "cancelBatch",
      args: TaskTransitionBatchArgs,
      returns: TaskWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reopenBatch",
      args: TaskTransitionBatchArgs,
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
      name: "renameForChurch",
      args: WorkflowRenameArgs,
      returns: WorkflowWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reorderForChurch",
      args: WorkflowReorderArgs,
      returns: WorkflowWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "archiveForChurch",
      args: WorkflowArchiveArgs,
      returns: WorkflowWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setDefaultForChurch",
      args: WorkflowSetDefaultArgs,
      returns: WorkflowWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "addStatus",
      args: WorkflowAddStatusArgs,
      returns: WorkflowWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "renameStatus",
      args: WorkflowRenameStatusArgs,
      returns: WorkflowWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reorderStatuses",
      args: WorkflowReorderStatusesArgs,
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
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setCycleAdjustments",
      args: TemplateSetCycleAdjustmentsArgs,
      returns: TemplateWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "previewCycleAdjustmentMerge",
      args: TemplatePreviewCycleAdjustmentMergeArgs,
      returns: TemplateReadResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "materializeProjectedTasks",
      args: TemplateMaterializeProjectedTasksArgs,
      returns: TemplateWriteResponse,
    }),
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateTemplateTasks",
      args: TemplateUpdateTasksArgs,
      returns: TemplateWriteResponse,
    }),
  );
