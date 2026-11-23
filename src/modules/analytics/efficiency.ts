import { mean, median, standardDeviation } from "simple-statistics";
import type { PrismaClient } from "@prisma/client";

type EfficiencyGroup = { operatorId: string | null; operatorName: string; month: string; periodStart: string; periodEnd: string; avgHours: number; medianHours: number; stdDevHours: number; lotsCount: number; bottleneck: boolean };
export type EfficiencyResult = { generatedAt: string; periodStart: string | null; periodEnd: string | null; avgHours: number; medianHours: number; stdDevHours: number; lotsCount: number; bottleneckThreshold: number; groups: EfficiencyGroup[] };

export async function analyzeEfficiency(db: PrismaClient, save = true): Promise<EfficiencyResult> {
  const lots = await db.lote.findMany({ where: { status: "FINALIZADO" }, include: { equipamentos: { include: { movimentacoes: { orderBy: { data: "asc" }, include: { usuario: { select: { id: true, nome: true } } } } } } } });
  const cycles: Array<{ hours: number; operatorId: string | null; operatorName: string; month: string; start: Date; end: Date }> = [];
  for (const lot of lots) {
    const moves = lot.equipamentos.flatMap(e => e.movimentacoes);
    const endMove = moves.filter(m => ["APTO_REUSO", "APTO_RECICLAGEM", "DESCARTADO"].includes(m.statusNovo)).at(-1) ?? moves.at(-1);
    if (!endMove || endMove.data < lot.dataEntrada) continue;
    const hours = (endMove.data.getTime() - lot.dataEntrada.getTime()) / 3_600_000;
    cycles.push({ hours, operatorId: endMove.usuarioId, operatorName: endMove.usuario.nome, month: endMove.data.toISOString().slice(0, 7), start: lot.dataEntrada, end: endMove.data });
  }
  const values = cycles.map(c => c.hours);
  const avgHours = values.length ? mean(values) : 0;
  const stdDevHours = values.length > 1 ? standardDeviation(values) : 0;
  const threshold = avgHours + stdDevHours;
  const grouped = new Map<string, typeof cycles>();
  for (const cycle of cycles) { const key = `${cycle.operatorId ?? "unknown"}|${cycle.month}`; grouped.set(key, [...(grouped.get(key) ?? []), cycle]); }
  const groups: EfficiencyGroup[] = [...grouped.values()].map(items => {
    const hrs = items.map(x => x.hours); const first = items[0]!;
    const groupAvg = hrs.length ? mean(hrs) : 0;
    return { operatorId: first.operatorId, operatorName: first.operatorName, month: first.month, periodStart: new Date(Math.min(...items.map(x=>x.start.getTime()))).toISOString(), periodEnd: new Date(Math.max(...items.map(x=>x.end.getTime()))).toISOString(), avgHours: groupAvg, medianHours: hrs.length ? median(hrs) : 0, stdDevHours: hrs.length > 1 ? standardDeviation(hrs) : 0, lotsCount: items.length, bottleneck: groupAvg > threshold };
  }).sort((a,b) => a.month.localeCompare(b.month) || b.avgHours-a.avgHours);
  const result: EfficiencyResult = { generatedAt: new Date().toISOString(), periodStart: cycles.length ? new Date(Math.min(...cycles.map(x=>x.start.getTime()))).toISOString() : null, periodEnd: cycles.length ? new Date(Math.max(...cycles.map(x=>x.end.getTime()))).toISOString() : null, avgHours, medianHours: values.length ? median(values) : 0, stdDevHours, lotsCount: cycles.length, bottleneckThreshold: threshold, groups };
  if (save && groups.length) await db.efficiencyReport.createMany({ data: groups.map(g => ({ periodStart: new Date(g.periodStart), periodEnd: new Date(g.periodEnd), operatorId: g.operatorId, operatorName: g.operatorName, month: g.month, avgHours: g.avgHours, medianHours: g.medianHours, stdDevHours: g.stdDevHours, lotsCount: g.lotsCount, bottleneck: g.bottleneck })) });
  return result;
}
