export const getIdType = (id: string) => id.split("_")[0] ?? id;

const getEntityId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export const getOrgId = () => getEntityId("org");
export const getUserId = () => getEntityId("user");
export const getTeamId = () => getEntityId("team");
export const getTaskId = () => getEntityId("task");
export const getTemplateId = () => getEntityId("template");
export const getCycleId = () => getEntityId("cycle");
export const getWorkflowId = () => getEntityId("workflow");
export const getChurchInvitationId = () => getEntityId("church_invitation");
