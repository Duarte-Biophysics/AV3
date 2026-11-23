import type { PrismaClient } from "@prisma/client";
import { analyzeEfficiency } from "../analytics/efficiency.js";
import { analyzeProfitability } from "../analytics/profitability.js";
import { analyzeLifespan } from "../analytics/lifespan.js";
import { writeReport, type ExportFormat } from "../reports/generator.js";
import { settings } from "../../config/settings.js";

export async function runAnalysis(db: PrismaClient, type: string) {
  if (type === "efficiency") return analyzeEfficiency(db);
  if (type === "profitability") return analyzeProfitability(db);
  if (type === "lifespan") return analyzeLifespan(db,true,settings.minLifespanSamples);
  throw new Error(`Tipo de relatorio desconhecido: ${type}`);
}
const retryMs = [10_000,60_000,300_000];
export function startJobWorker(db: PrismaClient, log: (message: string,error?: unknown)=>void = console.error) {
  let running=false;
  const recover = async () => { await db.reportJob.updateMany({ where: { status: "PROCESSING" }, data: { status: "PENDING", nextRunAt: new Date(), error: "Recuperado apos reinicio do servidor." } }); };
  const processOne = async () => {
    if (running) return; running=true;
    try {
      const candidate=await db.reportJob.findFirst({where:{status:"PENDING",nextRunAt:{lte:new Date()}},orderBy:{createdAt:"asc"}});
      if (!candidate) return;
      const claim=await db.reportJob.updateMany({where:{id:candidate.id,status:"PENDING"},data:{status:"PROCESSING",attempts:{increment:1},error:null}});
      if (!claim.count) return;
      const attempt=candidate.attempts+1;
      try { const result=await runAnalysis(db,candidate.type); const file=await writeReport(candidate.id,candidate.type,candidate.format as ExportFormat,result); await db.reportJob.update({where:{id:candidate.id},data:{status:"DONE",filePath:file.filePath,finishedAt:new Date(),error:null}}); }
      catch(error) { const message=error instanceof Error?error.message:"Falha desconhecida"; if (attempt < candidate.maxAttempts) await db.reportJob.update({where:{id:candidate.id},data:{status:"PENDING",nextRunAt:new Date(Date.now()+retryMs[Math.min(attempt-1,retryMs.length-1)]!),error:message}}); else await db.reportJob.update({where:{id:candidate.id},data:{status:"FAILED",finishedAt:new Date(),error:message}}); log(`Falha ao processar pedido ${candidate.id}`,error); }
    } catch(error) { log("Erro no worker de relatorios",error); }
    finally { running=false; }
  };
  let timer: NodeJS.Timeout | undefined;
  return { start: async () => { await recover(); timer=setInterval(()=>void processOne(),settings.workerPollMs); void processOne(); }, stop: () => { if(timer) clearInterval(timer); }, processOne };
}

