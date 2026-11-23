import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ApiKey } from "@prisma/client";
import { unauthorized, forbidden } from "../../shared/errors.js";

export type ApiPermission = "trace:read" | "lots:read" | "lots:write" | "reports:read";
declare module "fastify" { interface FastifyRequest { apiKey: ApiKey | null } }
export const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");
export function generateApiKey() { const secret = randomBytes(32).toString("hex"); return `gc_${secret}`; }
export async function authenticateApiKey(app: FastifyInstance, request: FastifyRequest, permission: ApiPermission) {
  const raw = request.headers["x-api-key"];
  if (typeof raw !== "string" || raw.length < 20) throw unauthorized("Informe uma chave x-api-key valida.");
  const key = await app.prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(raw) } });
  if (!key?.active || (key.expiresAt && key.expiresAt <= new Date())) throw unauthorized("Chave ausente, invalida, revogada ou expirada.");
  const stored = Buffer.from(key.keyHash,"hex"), supplied = Buffer.from(hashApiKey(raw),"hex");
  if (stored.length !== supplied.length || !timingSafeEqual(stored,supplied)) throw unauthorized("Chave de API invalida.");
  request.apiKey = key;
  if (!key.permissions.split(",").map(x=>x.trim()).includes(permission)) throw forbidden("A chave nao possui permissao para esta operacao.");
  return key;
}
