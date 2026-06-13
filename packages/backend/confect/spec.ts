import { Spec } from "@confect/core";

import {
  activities,
  agent,
  auth,
  churchSettings,
  coreWork,
  cycleMaintenance,
  healthCheck,
  keyDates,
  labels,
  privateData,
  tasks,
  templates,
  teams,
  workDefaults,
  workflows,
} from "./app.spec";

export default Spec.make()
  .add(activities)
  .add(agent)
  .add(auth)
  .add(churchSettings)
  .add(coreWork)
  .add(cycleMaintenance)
  .add(healthCheck)
  .add(keyDates)
  .add(labels)
  .add(privateData)
  .add(tasks)
  .add(templates)
  .add(teams)
  .add(workDefaults)
  .add(workflows);
