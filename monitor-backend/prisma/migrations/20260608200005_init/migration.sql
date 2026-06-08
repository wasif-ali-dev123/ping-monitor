-- CreateTable
CREATE TABLE "PingRecord" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "payload" JSONB NOT NULL,
    "statusCode" INTEGER,
    "responseBody" JSONB,
    "responseTime" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PingRecord_createdAt_idx" ON "PingRecord"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "PingRecord_success_idx" ON "PingRecord"("success");
