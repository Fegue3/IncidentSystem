export async function resetDb(prisma: any) {
  const safe = async (fn?: () => Promise<any>) => {
    try {
      if (fn) await fn();
    } catch {
      // ignore
    }
  };

  // ordem importa por FKs
  await safe(() => prisma.incidentComment?.deleteMany({}));
  await safe(() => prisma.incidentTimelineEvent?.deleteMany({}));
  await safe(() => prisma.notificationSubscription?.deleteMany({}));
  await safe(() => prisma.categoryOnIncident?.deleteMany({}));
  await safe(() => prisma.tagOnIncident?.deleteMany?.({}));
  await safe(() => prisma.incident?.deleteMany({}));

  await safe(() => prisma.team?.deleteMany({}));
  await safe(() => prisma.user?.deleteMany({}));

  await safe(() => prisma.tag?.deleteMany({}));
  await safe(() => prisma.category?.deleteMany({}));
}
