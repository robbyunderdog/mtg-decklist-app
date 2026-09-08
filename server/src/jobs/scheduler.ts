// Registers every background/cron job. Called once from index.ts at process startup.
import { scheduleNightlyPriceRefresh } from "./priceRefresh.js";

export function startJobs() {
  scheduleNightlyPriceRefresh();
}
