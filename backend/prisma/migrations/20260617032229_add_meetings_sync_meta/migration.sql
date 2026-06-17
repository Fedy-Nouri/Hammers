-- AlterTable
ALTER TABLE "google_integrations" ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "syncToken" TEXT;

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "meetLink" TEXT,
    "attendees" JSONB NOT NULL DEFAULT '[]',
    "htmlLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meetings_userId_startTime_idx" ON "meetings"("userId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_userId_googleEventId_key" ON "meetings"("userId", "googleEventId");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
