-- AD-001: user role (user | admin) for the operator console.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
