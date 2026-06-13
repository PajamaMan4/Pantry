import { defineConfig } from "drizzle-kit";

// drizzle-kit reads this to generate SQL migrations from the schema and to power
// `drizzle-kit studio`. The runtime connection lives in src/lib/db/client.ts.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: "./data/pantry.db",
  },
  verbose: true,
  strict: true,
});
