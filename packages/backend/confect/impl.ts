import { Impl } from "@confect/server";
import { Layer } from "effect";

import api from "./_generated/api";
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
} from "./app.impl";

export default Impl.make(api).pipe(
  Layer.provide(activities),
  Layer.provide(agent),
  Layer.provide(auth),
  Layer.provide(churchSettings),
  Layer.provide(coreWork),
  Layer.provide(cycleMaintenance),
  Layer.provide(healthCheck),
  Layer.provide(keyDates),
  Layer.provide(labels),
  Layer.provide(privateData),
  Layer.provide(tasks),
  Layer.provide(templates),
  Layer.provide(teams),
  Layer.provide(workDefaults),
  Layer.provide(workflows),
  Impl.finalize,
);
