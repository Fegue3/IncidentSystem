// test/integration/_helpers/prisma-reset.ts
export async function resetDb(prisma: any) {
  const safe = async (fn?: () => Promise<any>) => {
    try {
      if (fn) await fn();
    } catch {
      // ignore
    }
  };

  // --- INCIDENTS ---
  await safe(() => prisma.incidentComment?.deleteMany({}));
  await safe(() => prisma.incidentTimelineEvent?.deleteMany({}));
  await safe(() => prisma.notificationSubscription?.deleteMany({}));
  await safe(() => prisma.categoryOnIncident?.deleteMany({}));
  await safe(() => prisma._IncidentTags?.deleteMany({}));
  await safe(() => prisma.incidentSource?.deleteMany({}));
  await safe(() => prisma.incident?.deleteMany({}));

  // --- SERVICES ---
  await safe(() => prisma.service?.deleteMany({}));

  // --- TEAMS / USERS ---
  await safe(() => prisma._TeamMembers?.deleteMany({}));
  await safe(() => prisma.team?.deleteMany({}));
  await safe(() => prisma.user?.deleteMany({}));

  // --- CATEGORIES / TAGS ---
  await safe(() => prisma.tag?.deleteMany({}));
  await safe(() => prisma.category?.deleteMany({}));
}
