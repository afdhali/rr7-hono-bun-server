// app/server/types.ts
import type { User } from "~/db/schema";

// Simplified Env type definition
export type AppVariables = {
  user?: User;
};
