import { Spec } from "@confect/core";

import { auth, healthCheck, privateData } from "./app.spec";

export default Spec.make().add(auth).add(healthCheck).add(privateData);
