-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "auditHash" TEXT,
ADD COLUMN     "auditHashUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Incident_auditHashUpdatedAt_idx" ON "Incident"("auditHashUpdatedAt");
