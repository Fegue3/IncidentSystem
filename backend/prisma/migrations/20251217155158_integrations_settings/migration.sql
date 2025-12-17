-- CreateEnum
CREATE TYPE "IntegrationKind" AS ENUM ('DATADOG', 'PAGERDUTY');

-- CreateTable
CREATE TABLE "IntegrationSetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSavedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntegrationSetting_userId_idx" ON "IntegrationSetting"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSetting_userId_kind_key" ON "IntegrationSetting"("userId", "kind");

-- AddForeignKey
ALTER TABLE "IntegrationSetting" ADD CONSTRAINT "IntegrationSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
