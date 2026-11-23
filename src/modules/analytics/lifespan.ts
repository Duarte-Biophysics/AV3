import { linearRegression, linearRegressionLine } from "simple-statistics";
import type { PrismaClient } from "@prisma/client";
const stateScore: Record<string, number> = { INSERVIVEL: 0, PESSIMO: 1, RUIM: 2, REGULAR: 3, BOM: 4 };
export type LifespanGroup = { equipmentType: string; slope: number; intercept: number; remainingMonths: number; sampleSize: number; sufficientData: boolean; status: "OK" | "DADOS_INSUFICIENTES" };
export async function analyzeLifespan(db: PrismaClient, save = true, minimumSamples = 5): Promise<{ generatedAt: string; minimumSamples: number; groups: LifespanGroup[] }> {
  const equipment = await db.equipamento.findMany({ include: { lote: true, movimentacoes: { orderBy: { data: "asc" } } } });
  const grouped = new Map<string, Array<[number,number]>>();
  for (const item of equipment) {
    const points = grouped.get(item.tipo) ?? [];
    const origin = item.lote.dataEntrada;
    points.push([Math.max(0,(item.criadoEm.getTime()-origin.getTime())/2_592_000_000), stateScore[item.estadoFisico] ?? 0]);
    for (const m of item.movimentacoes) points.push([Math.max(0,(m.data.getTime()-origin.getTime())/2_592_000_000), stateScore[m.estadoFisicoNovo] ?? 0]);
    grouped.set(item.tipo,points);
  }
  const groups: LifespanGroup[] = [...grouped.entries()].map(([equipmentType,points]) => {
    if (points.length < minimumSamples) return { equipmentType, slope: 0, intercept: 0, remainingMonths: 0, sampleSize: points.length, sufficientData: false, status: "DADOS_INSUFICIENTES" as const };
    const regression = linearRegression(points);
    const line = linearRegressionLine(regression);
    const currentAge = Math.max(...points.map(p=>p[0]));
    const currentCondition = line(currentAge);
    const crossing = regression.m < 0 ? currentAge + currentCondition / -regression.m : currentAge;
    return { equipmentType, slope: regression.m, intercept: regression.b, remainingMonths: Math.max(0,crossing-currentAge), sampleSize: points.length, sufficientData: true, status: "OK" as const };
  }).sort((a,b)=>a.equipmentType.localeCompare(b.equipmentType));
  if (save && groups.length) await db.lifespanForecast.createMany({ data: groups.map(g => ({ equipmentType: g.equipmentType as any, slope: g.slope, intercept: g.intercept, remainingMonths: g.remainingMonths, sampleSize: g.sampleSize, sufficientData: g.sufficientData })) });
  return { generatedAt: new Date().toISOString(), minimumSamples, groups };
}


