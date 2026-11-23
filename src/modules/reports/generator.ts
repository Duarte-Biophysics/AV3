import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { settings } from "../../config/settings.js";
export type ExportFormat = "json" | "csv";
function csvCell(value: unknown): string { const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text; }
function rowsOf(value: unknown): Record<string,unknown>[] { if (Array.isArray(value)) return value as Record<string,unknown>[]; if (value && typeof value === "object") { const obj=value as Record<string,unknown>; const list=Object.values(obj).find(Array.isArray); return list ? list as Record<string,unknown>[] : [obj]; } return [{ value }]; }
export async function writeReport(id: string, type: string, format: ExportFormat, value: unknown) {
  const directory=path.join(process.cwd(),settings.reportsDirectory); await mkdir(directory,{recursive:true});
  const filePath=path.join(directory,`${id}.${format}`);
  if (format === "json") await writeFile(filePath,JSON.stringify(value,null,2),"utf8");
  else { const rows=rowsOf(value); const headers=[...new Set(rows.flatMap(row=>Object.keys(row)))]; const csv=[headers.map(csvCell).join(","),...rows.map(row=>headers.map(h=>csvCell(row[h])).join(","))].join("\r\n"); await writeFile(filePath,csv,"utf8"); }
  return { filePath, fileName: `${type}-${id}.${format}` };
}

