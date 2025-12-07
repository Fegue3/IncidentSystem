/*
  Warnings:

  - You are about to drop the column `priority` on the `Incident` table. All the data in the column will be lost.
  - The primary key for the `_IncidentTags` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_TeamMembers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_IncidentTags` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_TeamMembers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('SEV1', 'SEV2', 'SEV3', 'SEV4');

-- DropIndex
DROP INDEX "Incident_status_priority_idx";

-- AlterTable
ALTER TABLE "Incident" DROP COLUMN "priority",
ADD COLUMN     "severity" "Severity" NOT NULL DEFAULT 'SEV3';

-- AlterTable
ALTER TABLE "_IncidentTags" DROP CONSTRAINT "_IncidentTags_AB_pkey";

-- AlterTable
ALTER TABLE "_TeamMembers" DROP CONSTRAINT "_TeamMembers_AB_pkey";

-- DropEnum
DROP TYPE "Priority";

-- CreateIndex
CREATE INDEX "Incident_status_severity_idx" ON "Incident"("status", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "_IncidentTags_AB_unique" ON "_IncidentTags"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_TeamMembers_AB_unique" ON "_TeamMembers"("A", "B");
