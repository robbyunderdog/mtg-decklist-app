// Validates and types process.env at startup. Import `env` anywhere a config value is
// needed instead of reading `process.env` directly — this is the one place that can fail
// fast (and with a clear message) if a required variable is missing.
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  // Sent as part of the Scryfall API User-Agent per their API etiquette guidelines.
  SCRYFALL_CONTACT_EMAIL: z.string().default("not-set@example.com"),
});

// Throws immediately on import if any required variable is missing/invalid, rather than
// failing later with a confusing error the first time the value is used.
export const env = envSchema.parse(process.env);
