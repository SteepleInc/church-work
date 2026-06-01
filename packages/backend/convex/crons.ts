import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron(
  "Sunday Cycle maintenance",
  "0 8 * * 0",
  internal.cycleMaintenance.internalRunForAllChurches,
  {},
);

export default crons;
