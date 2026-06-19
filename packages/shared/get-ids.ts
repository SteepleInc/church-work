import { getType, typeid } from "typeid-js";

const getEntityId = <const Prefix extends string>(prefix: Prefix) => typeid(prefix).toString();

export const getIdType = (id: string) => getType(id as never);

export const getOrgId = () => getEntityId("org");
export const getUserId = () => getEntityId("user");
export const getSessionId = () => getEntityId("session");
export const getAccountId = () => getEntityId("account");
export const getApiKeyId = () => getEntityId("apikey");
export const getVerificationId = () => getEntityId("verification");
export const getOrgUserId = () => getEntityId("orguser");
export const getTeamId = () => getEntityId("team");
export const getTeamMembershipId = () => getEntityId("teammembership");
export const getTaskId = () => getEntityId("task");
export const getLabelId = () => getEntityId("label");
export const getTemplateId = () => getEntityId("template");
export const getTemplateScheduleId = () => getEntityId("templateschedule");
export const getTemplateTeamId = () => getEntityId("templateteam");
export const getTemplateTaskId = () => getEntityId("templatetask");
export const getFocusWindowId = () => getEntityId("focuswindow");
export const getCycleId = () => getEntityId("cycle");
export const getCycleAdjustmentId = () => getEntityId("cycleadjustment");
export const getKeyDateId = () => getEntityId("keydate");
export const getKeyDateOccurrenceId = () => getEntityId("keydateoccurrence");
export const getWorkflowId = () => getEntityId("workflow");
export const getWorkflowStatusId = () => getEntityId("workflowstatus");
export const getChurchInvitationId = () => getEntityId("churchinvitation");
export const getDemoItemId = () => getEntityId("demoitem");
export const getActivityId = () => getEntityId("activity");
