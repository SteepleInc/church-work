import { createInsertSchema, createSelectSchema } from "drizzle-orm/effect-schema";

import { demo_items } from "./schema";

export const DemoItemSelectSchema = createSelectSchema(demo_items);
export const DemoItemInsertSchema = createInsertSchema(demo_items);
