import { Impl } from "@confect/server";
import { Layer } from "effect";

import api from "./_generated/api";
import { agent, auth, healthCheck, privateData } from "./app.impl";

export default Impl.make(api).pipe(
  Layer.provide(agent),
  Layer.provide(auth),
  Layer.provide(healthCheck),
  Layer.provide(privateData),
  Impl.finalize,
);
