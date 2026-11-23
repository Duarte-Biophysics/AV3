import cron from "node-cron";
import type { PrismaClient } from "@prisma/client";
import { settings } from "../config/settings.js";
import { runAnalysis } from "../modules/jobs/worker.js";
export function startScheduler(db: PrismaClient, log: (message:string,error?:unknown)=>void = console.error) {
  const schedules = [ [settings.efficiencyCron,"efficiency"], [settings.profitabilityCron,"profitability"], [settings.lifespanCron,"lifespan"] ] as const;
  const tasks=schedules.map(([expression,type])=>cron.schedule(expression,()=>{ void runAnalysis(db,type).catch(error=>log(`Falha na analise agendada ${type}`,error)); }));
  return () => tasks.forEach(task=>task.stop());
}
