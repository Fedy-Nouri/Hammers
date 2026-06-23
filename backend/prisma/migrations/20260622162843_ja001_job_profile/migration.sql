-- CreateTable
CREATE TABLE "job_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeUrl" TEXT,
    "resumeText" TEXT,
    "desiredTitles" TEXT[],
    "locations" TEXT[],
    "remotePref" TEXT NOT NULL DEFAULT 'any',
    "salaryMin" INTEGER,
    "keywords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_profiles_userId_key" ON "job_profiles"("userId");

-- AddForeignKey
ALTER TABLE "job_profiles" ADD CONSTRAINT "job_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
