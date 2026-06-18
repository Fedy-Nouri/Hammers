-- CreateTable
CREATE TABLE "bot_jobs" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_segments" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "speaker" INTEGER,
    "text" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_analyses" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "processedUpToMs" INTEGER NOT NULL DEFAULT 0,
    "segmentsSeen" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_items" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "assignee" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risks" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'risk',
    "transcriptRefMs" INTEGER,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_reports" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "executive" TEXT NOT NULL DEFAULT '',
    "followUps" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followup_emails" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "followup_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_jobs_meetingId_key" ON "bot_jobs"("meetingId");

-- CreateIndex
CREATE INDEX "transcript_segments_meetingId_startMs_idx" ON "transcript_segments"("meetingId", "startMs");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_analyses_meetingId_key" ON "meeting_analyses"("meetingId");

-- CreateIndex
CREATE INDEX "action_items_meetingId_idx" ON "action_items"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "action_items_meetingId_dedupeKey_key" ON "action_items"("meetingId", "dedupeKey");

-- CreateIndex
CREATE INDEX "decisions_meetingId_idx" ON "decisions"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "decisions_meetingId_dedupeKey_key" ON "decisions"("meetingId", "dedupeKey");

-- CreateIndex
CREATE INDEX "risks_meetingId_idx" ON "risks"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "risks_meetingId_dedupeKey_key" ON "risks"("meetingId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_reports_meetingId_key" ON "meeting_reports"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "followup_emails_meetingId_key" ON "followup_emails"("meetingId");

-- AddForeignKey
ALTER TABLE "bot_jobs" ADD CONSTRAINT "bot_jobs_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_analyses" ADD CONSTRAINT "meeting_analyses_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risks" ADD CONSTRAINT "risks_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reports" ADD CONSTRAINT "meeting_reports_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followup_emails" ADD CONSTRAINT "followup_emails_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
