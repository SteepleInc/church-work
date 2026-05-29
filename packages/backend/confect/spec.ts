import { Spec } from "@confect/core";

import { agent, auth, healthCheck, privateData } from "./app.spec";

export default Spec.make().add(agent).add(auth).add(healthCheck).add(privateData);
