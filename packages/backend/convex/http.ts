import { httpRouter } from "convex/server";

import { authComponent, createAuth } from "../authCore";
import { polar } from "./polar";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });

polar.registerRoutes(http);

export default http;
