-- MK-001: per-user agent install + plan gate.

-- AlterTable: agent minimum plan (free | pro | enterprise)
ALTER TABLE "agents" ADD COLUMN "minPlan" TEXT NOT NULL DEFAULT 'free';

-- CreateTable
CREATE TABLE "installed_agents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installed_agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "installed_agents_userId_agentId_key" ON "installed_agents"("userId", "agentId");

-- AddForeignKey
ALTER TABLE "installed_agents" ADD CONSTRAINT "installed_agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installed_agents" ADD CONSTRAINT "installed_agents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: auto-install agents users already use, so nothing disappears. FK-safe (joins agents).
INSERT INTO "installed_agents" ("id", "userId", "agentId", "createdAt")
SELECT gen_random_uuid(), c."userId", c."agentId", CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "userId", "agentId" FROM "conversations") c
JOIN "agents" a ON a."id" = c."agentId"
ON CONFLICT ("userId", "agentId") DO NOTHING;

-- Backfill the Job Hunter for users who set up a profile or tracked an application.
INSERT INTO "installed_agents" ("id", "userId", "agentId", "createdAt")
SELECT gen_random_uuid(), u."userId", 'job-agent', CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "userId" FROM "job_profiles"
  UNION
  SELECT DISTINCT "userId" FROM "job_applications"
) u
WHERE EXISTS (SELECT 1 FROM "agents" WHERE "id" = 'job-agent')
ON CONFLICT ("userId", "agentId") DO NOTHING;
