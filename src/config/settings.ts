import { env } from "./env.js";
export const settings = {
  rateLimitMax: Number(process.env.API_RATE_LIMIT_MAX ?? 60),
  rateLimitWindow: process.env.API_RATE_LIMIT_WINDOW ?? "1 minute",
  workerPollMs: Number(process.env.WORKER_POLL_MS ?? 3000),
  efficiencyCron: process.env.CRON_EFFICIENCY ?? "0 2 * * *",
  profitabilityCron: process.env.CRON_PROFITABILITY ?? "0 2 * * *",
  lifespanCron: process.env.CRON_LIFESPAN ?? "0 2 * * 1",
  minLifespanSamples: Number(process.env.MIN_LIFESPAN_SAMPLES ?? 5),
  reportsDirectory: process.env.REPORTS_DIRECTORY ?? "reports-output",
};
export { env };
