import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { settings } from "../../config/settings.js";
import { authenticateApiKey, hashApiKey, type ApiPermission } from "../../modules/auth/api-key.js";

const errorSchema = { type: "object", properties: { error: { type: "string" }, statusCode: { type: "integer" } }, required: ["error", "statusCode"] };
const apiKeySecurity = { security: [{ apiKeyAuth: [] }] };
const keyHook = (permission: ApiPermission) => async (request: FastifyRequest) => { await authenticateApiKey(request.server, request, permission); };
const notFound = (message: string) => Object.assign(new Error(message), { statusCode: 404 });
const badRequest = (message: string) => Object.assign(new Error(message), { statusCode: 400 });

export async function registerPublicRoutes(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: settings.rateLimitMax,
    timeWindow: settings.rateLimitWindow,
    keyGenerator: (request: FastifyRequest) => {
      const key = request.headers["x-api-key"];
      return typeof key === "string" ? `partner:${hashApiKey(key)}` : `missing:${request.ip}`;
    },
  });

  app.get("/trace/:equipmentId", {
    config: { public: true }, preHandler: keyHook("trace:read"),
    schema: { ...apiKeySecurity, tags: ["Parceiros"], summary: "Consultar rastreabilidade de equipamento", description: "Retorna o equipamento, lote, organizacao e historico de movimentacoes.", params: { type: "object", required: ["equipmentId"], properties: { equipmentId: { type: "string", format: "uuid" } } }, response: { 200: { type: "object", additionalProperties: true }, 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 429: errorSchema, 500: errorSchema } },
  }, async request => {
    const { equipmentId } = request.params as { equipmentId: string };
    const item = await app.prisma.equipamento.findUnique({ where: { id: equipmentId }, include: { lote: { include: { organizacao: true } }, movimentacoes: { orderBy: { data: "asc" }, include: { usuario: { select: { nome: true } } } } } });
    if (!item) throw notFound("Equipamento nao encontrado.");
    return item;
  });

  app.get("/lots/:id", {
    config: { public: true }, preHandler: keyHook("lots:read"),
    schema: { ...apiKeySecurity, tags: ["Parceiros"], summary: "Consultar lote por ID", params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } }, response: { 200: { type: "object", additionalProperties: true }, 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 429: errorSchema, 500: errorSchema } },
  }, async request => {
    const { id } = request.params as { id: string };
    const lot = await app.prisma.lote.findUnique({ where: { id }, include: { organizacao: true, contrato: true, equipamentos: true } });
    if (!lot) throw notFound("Lote nao encontrado.");
    return lot;
  });

  const lotBodySchema = {
    type: "object", required: ["organizacaoId", "contratoId", "numeroNotaFiscal", "transportadora", "dataEntrada"],
    properties: {
      organizacaoId: { type: "string", format: "uuid" }, contratoId: { type: "string", format: "uuid" },
      numeroNotaFiscal: { type: "string" }, transportadora: { type: "string" },
      dataEntrada: { type: "string", format: "date" },
      equipamentos: { type: "array", items: { type: "object", required: ["codigoBarras", "tipo", "estadoFisico"], properties: {
        codigoBarras: { type: "string" }, tipo: { type: "string", enum: ["COMPUTADOR", "NOTEBOOK", "CELULAR", "TABLET", "IMPRESSORA", "OUTRO"] },
        estadoFisico: { type: "string", enum: ["INSERVIVEL", "PESSIMO", "RUIM", "REGULAR", "BOM"] }, valorRecuperacao: { type: "number", minimum: 0 }, marca: { type: "string" }, modelo: { type: "string" },
      } } },
    },
  };
  app.post("/lots", {
    config: { public: true }, preHandler: keyHook("lots:write"),
    schema: { ...apiKeySecurity, tags: ["Parceiros"], summary: "Enviar lote", description: "Cria lote com equipamentos opcionais e registra o recebimento inicial.", body: lotBodySchema,
      response: { 202: { type: "object", properties: { id: { type: "string" }, status: { type: "string" } }, required: ["id", "status"] }, 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 429: errorSchema, 500: errorSchema } },
  }, async (request, reply) => {
    const body = request.body as any;
    const [org, contract, adminUser] = await Promise.all([
      app.prisma.organizacao.findFirst({ where: { id: body.organizacaoId, ativa: true } }),
      app.prisma.contrato.findUnique({ where: { id: body.contratoId } }),
      app.prisma.usuario.findFirst({ where: { ativo: true, papel: "ADMINISTRADOR" }, select: { id: true } }),
    ]);
    if (!adminUser) throw new Error("Cadastre um administrador antes de receber lotes pela API publica.");
    if (!org || !contract || contract.organizacaoId !== org.id || contract.status !== "ATIVO") throw badRequest("Organizacao ativa e contrato valido sao obrigatorios.");
    const lot = await app.prisma.lote.create({ data: {
      organizacaoId: org.id, contratoId: contract.id, numeroNotaFiscal: body.numeroNotaFiscal.trim(), transportadora: body.transportadora.trim(), dataEntrada: new Date(`${body.dataEntrada}T00:00:00.000Z`),
      equipamentos: { create: (body.equipamentos ?? []).map((e: any) => ({ codigoBarrasInterno: e.codigoBarras.trim().toUpperCase(), tipo: e.tipo, estadoFisico: e.estadoFisico, valorRecuperacao: e.valorRecuperacao, marca: e.marca, modelo: e.modelo, movimentacoes: { create: { usuarioId: adminUser.id, statusAnterior: "RECEBIDO", statusNovo: "RECEBIDO", estadoFisicoAnterior: e.estadoFisico, estadoFisicoNovo: e.estadoFisico, observacao: "Recebido por API parceira." } } })) },
    } });
    return reply.code(202).send({ id: lot.id, status: "RECEBIDO" });
  });
  for (const type of ["efficiency", "profitability", "lifespan"] as const) {
    app.get(`/analytics/${type}`, {
      config: { public: true }, preHandler: keyHook("reports:read"),
      schema: { ...apiKeySecurity, tags: ["Analises"], summary: `Consultar ultimo resultado: ${type}`, response: { 200: { type: "array", items: { type: "object", additionalProperties: true } }, 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 429: errorSchema, 500: errorSchema } },
    }, async () => {
      const table: any = type === "efficiency" ? app.prisma.efficiencyReport : type === "profitability" ? app.prisma.profitabilityReport : app.prisma.lifespanForecast;
      const latest = await table.findFirst({ orderBy: { generatedAt: "desc" }, select: { generatedAt: true } });
      if (!latest) return [];
      return table.findMany({ where: { generatedAt: latest.generatedAt }, orderBy: { generatedAt: "desc" }, take: 100 });
    });
  }

  app.post("/reports", {
    config: { public: true }, preHandler: keyHook("reports:read"),
    schema: { ...apiKeySecurity, tags: ["Relatorios"], summary: "Criar relatorio em segundo plano", body: { type: "object", required: ["type", "format"], properties: { type: { type: "string", enum: ["efficiency", "profitability", "lifespan"] }, format: { type: "string", enum: ["json", "csv"] } } }, response: { 202: { type: "object", properties: { jobId: { type: "string", format: "uuid" }, status: { type: "string" } }, required: ["jobId", "status"] }, 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 429: errorSchema, 500: errorSchema } },
  }, async (request, reply) => {
    const body = request.body as { type: string; format: string };
    const job = await app.prisma.reportJob.create({ data: { apiKeyId: request.apiKey!.id, type: body.type, format: body.format, status: "PENDING" } });
    return reply.code(202).send({ jobId: job.id, status: job.status });
  });

  app.get("/reports/:jobId", {
    config: { public: true }, preHandler: keyHook("reports:read"),
    schema: { ...apiKeySecurity, tags: ["Relatorios"], summary: "Consultar status de relatorio", params: { type: "object", required: ["jobId"], properties: { jobId: { type: "string", format: "uuid" } } }, response: { 200: { type: "object", additionalProperties: true }, 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 429: errorSchema, 500: errorSchema } },
  }, async request => {
    const { jobId } = request.params as { jobId: string };
    const job = await app.prisma.reportJob.findFirst({ where: { id: jobId, apiKeyId: request.apiKey!.id }, select: { id: true, type: true, format: true, status: true, attempts: true, maxAttempts: true, nextRunAt: true, error: true, createdAt: true, finishedAt: true } });
    if (!job) throw notFound("Pedido nao encontrado.");
    return job;
  });

  app.get("/reports/:jobId/download", {
    config: { public: true }, preHandler: keyHook("reports:read"),
    schema: { ...apiKeySecurity, tags: ["Relatorios"], summary: "Baixar relatorio concluido", params: { type: "object", required: ["jobId"], properties: { jobId: { type: "string", format: "uuid" } } }, response: { 200: { type: "string", format: "binary" }, 400: errorSchema, 401: errorSchema, 403: errorSchema, 404: errorSchema, 429: errorSchema, 500: errorSchema } },
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = await app.prisma.reportJob.findFirst({ where: { id: jobId, apiKeyId: request.apiKey!.id, status: "DONE" } });
    if (!job?.filePath) throw notFound("Arquivo ainda indisponivel ou pedido nao encontrado.");
    const { createReadStream } = await import("node:fs");
    reply.header("Content-Type", job.format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8").header("Content-Disposition", `attachment; filename="${job.id}.${job.format}"`);
    return reply.send(createReadStream(job.filePath));
  });
}




