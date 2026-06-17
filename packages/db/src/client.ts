import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export const createPgPool = (connectionString: string) => new Pool({ connectionString });

export const createDb = (connectionString: string) => {
  const pool = createPgPool(connectionString);
  const db = drizzle({ client: pool });

  return { db, pool };
};

export type ChurchTaskDb = ReturnType<typeof createDb>["db"];
