// Process entry point: boots the HTTP server and the background job scheduler.
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startJobs } from "./jobs/scheduler.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});

// Nightly price-refresh cron, etc. — see jobs/scheduler.ts.
startJobs();
