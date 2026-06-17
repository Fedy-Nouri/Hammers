-- AlterTable
ALTER TABLE "ai_usage_logs" ADD COLUMN     "conversationId" TEXT,
ADD COLUMN     "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ai_usage_logs_userId_createdAt_idx" ON "ai_usage_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_logs_agentId_idx" ON "ai_usage_logs"("agentId");
