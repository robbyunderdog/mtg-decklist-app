import { scheduleNightlyPriceRefresh } from "./priceRefresh.js";

export function startJobs() {
  scheduleNightlyPriceRefresh();
}
