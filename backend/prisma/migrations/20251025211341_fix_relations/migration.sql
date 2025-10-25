-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('NEW', 'TRIAGED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('P1', 'P2', 'P3', 'P4');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REPORTER', 'AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('NAGIOS', 'DATADOG', 'PROMETHEUS', 'OTHER');

-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('STATUS_CHANGE', 'COMMENT', 'ASSIGNMENT', 'FIELD_UPDATE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'REPORTER',
    "refreshTokenHash" TEXT,
    "resetTokenHash" TEXT,
    "resetTokenExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'NEW',
    "priority" "Priority" NOT NULL DEFAULT 'P3',
    "reporterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "teamId" TEXT,
    "triagedAt" TIMESTAMP(3),
    "inProgressAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentTimelineEvent" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorId" TEXT,
    "type" "TimelineEventType" NOT NULL,
    "fromStatus" "IncidentStatus",
    "toStatus" "IncidentStatus",
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentComment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryOnIncident" (
    "incidentId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryOnIncident_pkey" PRIMARY KEY ("incidentId","categoryId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSource" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentSource" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "incidentId" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TeamMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TeamMembers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_IncidentTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_IncidentTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Incident_status_priority_idx" ON "Incident"("status", "priority");

-- CreateIndex
CREATE INDEX "Incident_assigneeId_idx" ON "Incident"("assigneeId");

-- CreateIndex
CREATE INDEX "Incident_reporterId_idx" ON "Incident"("reporterId");

-- CreateIndex
CREATE INDEX "Incident_teamId_idx" ON "Incident"("teamId");

-- CreateIndex
CREATE INDEX "Incident_createdAt_idx" ON "Incident"("createdAt");

-- CreateIndex
CREATE INDEX "IncidentTimelineEvent_incidentId_createdAt_idx" ON "IncidentTimelineEvent"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "IncidentComment_incidentId_createdAt_idx" ON "IncidentComment"("incidentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_label_key" ON "Tag"("label");

-- CreateIndex
CREATE INDEX "IntegrationSource_provider_idx" ON "IntegrationSource"("provider");

-- CreateIndex
CREATE INDEX "IncidentSource_incidentId_idx" ON "IncidentSource"("incidentId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentSource_integrationId_externalId_key" ON "IncidentSource"("integrationId", "externalId");

-- CreateIndex
CREATE INDEX "NotificationSubscription_userId_idx" ON "NotificationSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSubscription_userId_incidentId_categoryId_key" ON "NotificationSubscription"("userId", "incidentId", "categoryId");

-- CreateIndex
CREATE INDEX "_TeamMembers_B_index" ON "_TeamMembers"("B");

-- CreateIndex
CREATE INDEX "_IncidentTags_B_index" ON "_IncidentTags"("B");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentTimelineEvent" ADD CONSTRAINT "IncidentTimelineEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentTimelineEvent" ADD CONSTRAINT "IncidentTimelineEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentComment" ADD CONSTRAINT "IncidentComment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentComment" ADD CONSTRAINT "IncidentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryOnIncident" ADD CONSTRAINT "CategoryOnIncident_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryOnIncident" ADD CONSTRAINT "CategoryOnIncident_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentSource" ADD CONSTRAINT "IncidentSource_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentSource" ADD CONSTRAINT "IncidentSource_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "IntegrationSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSubscription" ADD CONSTRAINT "NotificationSubscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeamMembers" ADD CONSTRAINT "_TeamMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeamMembers" ADD CONSTRAINT "_TeamMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IncidentTags" ADD CONSTRAINT "_IncidentTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IncidentTags" ADD CONSTRAINT "_IncidentTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
