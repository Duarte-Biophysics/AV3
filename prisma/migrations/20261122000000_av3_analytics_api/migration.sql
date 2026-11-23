-- AlterTable
ALTER TABLE "Equipamento" ADD COLUMN     "marca" TEXT,
ADD COLUMN     "modelo" TEXT,
ADD COLUMN     "valorRecuperacao" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" UUID NOT NULL,
    "partnerName" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "permissions" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportJob" (
    "id" UUID NOT NULL,
    "apiKeyId" UUID,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filePath" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EfficiencyReport" (
    "id" UUID NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "operatorId" UUID,
    "operatorName" TEXT,
    "month" TEXT NOT NULL,
    "avgHours" DOUBLE PRECISION NOT NULL,
    "medianHours" DOUBLE PRECISION NOT NULL,
    "stdDevHours" DOUBLE PRECISION NOT NULL,
    "lotsCount" INTEGER NOT NULL,
    "bottleneck" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EfficiencyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitabilityReport" (
    "id" UUID NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equipmentType" "TipoEquipamento" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "physicalState" "EstadoFisico" NOT NULL,
    "avgRecoveryValue" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,

    CONSTRAINT "ProfitabilityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifespanForecast" (
    "id" UUID NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equipmentType" "TipoEquipamento" NOT NULL,
    "slope" DOUBLE PRECISION NOT NULL,
    "intercept" DOUBLE PRECISION NOT NULL,
    "remainingMonths" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "actualMonths" DOUBLE PRECISION,
    "sufficientData" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LifespanForecast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ReportJob_status_nextRunAt_idx" ON "ReportJob"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "ReportJob_apiKeyId_createdAt_idx" ON "ReportJob"("apiKeyId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReportJob" ADD CONSTRAINT "ReportJob_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

