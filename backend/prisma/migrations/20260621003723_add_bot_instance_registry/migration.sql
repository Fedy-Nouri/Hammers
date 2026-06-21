-- AlterTable
ALTER TABLE "bot_jobs" ADD COLUMN     "botInstanceId" TEXT;

-- CreateTable
CREATE TABLE "bot_instances" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "currentMeetingId" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_instances_currentMeetingId_key" ON "bot_instances"("currentMeetingId");
