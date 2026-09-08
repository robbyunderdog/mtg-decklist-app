// Shared Postgres connection pool and Drizzle ORM instance. Import `db` from here anywhere
// the app needs to query the database — never open a second pool.
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Local Postgres has no TLS cert to verify; the hosted database (e.g. Neon) requires SSL
  // but its cert chain isn't one Node trusts out of the box, hence rejectUnauthorized: false.
  ssl: env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
