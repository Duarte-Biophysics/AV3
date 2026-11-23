import type { PrismaClient } from "@prisma/client";
export type ProfitabilityGroup = { equipmentType: string; brand: string | null; model: string | null; physicalState: string; avgRecoveryValue: number; sampleSize: number };
export async function analyzeProfitability(db: PrismaClient, save = true): Promise<{ generatedAt: string; groups: ProfitabilityGroup[] }> {
  const equipment = await db.equipamento.findMany({ where: { valorRecuperacao: { not: null } }, select: { tipo: true, marca: true, modelo: true, estadoFisico: true, valorRecuperacao: true } });
  const map = new Map<string, { base: Omit<ProfitabilityGroup,"avgRecoveryValue"|"sampleSize">; values: number[] }>();
  for (const e of equipment) { if (e.valorRecuperacao == null) continue; const key = [e.tipo,e.marca ?? "",e.modelo ?? "",e.estadoFisico].join("|"); const entry = map.get(key) ?? { base: { equipmentType: e.tipo, brand: e.marca, model: e.modelo, physicalState: e.estadoFisico }, values: [] }; entry.values.push(e.valorRecuperacao); map.set(key,entry); }
  const groups = [...map.values()].map(x => ({ ...x.base, avgRecoveryValue: x.values.reduce((a,b)=>a+b,0)/x.values.length, sampleSize: x.values.length })).sort((a,b)=>b.avgRecoveryValue-a.avgRecoveryValue);
  if (save && groups.length) await db.profitabilityReport.createMany({ data: groups.map(g => ({ equipmentType: g.equipmentType as any, brand: g.brand, model: g.model, physicalState: g.physicalState as any, avgRecoveryValue: g.avgRecoveryValue, sampleSize: g.sampleSize })) });
  return { generatedAt: new Date().toISOString(), groups };
}
