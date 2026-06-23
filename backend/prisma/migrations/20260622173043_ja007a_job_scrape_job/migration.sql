-- CreateTable
CREATE TABLE "job_scrape_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "requested" TEXT NOT NULL DEFAULT 'scheduled',
    "jobBotInstanceId" TEXT,
    "found" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_scrape_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_scrape_jobs_userId_status_idx" ON "job_scrape_jobs"("userId", "status");

-- CreateIndex
CREATE INDEX "job_scrape_jobs_status_idx" ON "job_scrape_jobs"("status");

-- AddForeignKey
ALTER TABLE "job_scrape_jobs" ADD CONSTRAINT "job_scrape_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
