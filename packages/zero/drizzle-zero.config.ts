import * as drizzleSchema from "@church-task/db/schema";
import { drizzleZeroConfig } from "drizzle-zero";

export default drizzleZeroConfig(drizzleSchema, {
  casing: "snake_case",
  tables: {
    demo_items: {
      _tag: true,
      created_at: true,
      created_by: true,
      deleted_at: true,
      deleted_by: true,
      id: true,
      name: true,
      owner_user_id: true,
      updated_at: true,
      updated_by: true,
    },
    labels: true,
    team_memberships: true,
    teams: true,
    tasks: true,
    workflow_statuses: true,
    workflows: true,
  },
});
