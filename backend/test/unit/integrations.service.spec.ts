import { IntegrationsService } from '../../src/integrations/integrations.service';
import { IntegrationKind } from '@prisma/client';

describe('IntegrationsService (unit)', () => {
    function makePrismaMock() {
        return {
            integrationSetting: {
                createMany: jest.fn(),
                findMany: jest.fn(),
                upsert: jest.fn(),
                findUnique: jest.fn(),
            },
        };
    }

    it('getForUser returns defaults (ON) when no rows exist', async () => {
        const prisma = makePrismaMock();
        prisma.integrationSetting.createMany.mockResolvedValueOnce({ count: 2 });
        prisma.integrationSetting.findMany.mockResolvedValueOnce([]);

        const svc = new IntegrationsService(prisma as any);

        const res = await svc.getForUser('user1');

        // default ON (failsafe)
        expect(res.datadog.notificationsEnabled).toBe(true);
        expect(res.pagerduty.notificationsEnabled).toBe(true);
        expect(res.datadog.lastSavedAt).toBeNull();
        expect(res.pagerduty.lastSavedAt).toBeNull();
    });

    it('getForUser merges db rows over defaults', async () => {
        const prisma = makePrismaMock();
        prisma.integrationSetting.createMany.mockResolvedValueOnce({ count: 2 });

        prisma.integrationSetting.findMany.mockResolvedValueOnce([
            {
                kind: IntegrationKind.DATADOG,
                notificationsEnabled: false,
                lastSavedAt: new Date('2025-01-01'),
            },
        ]);

        const svc = new IntegrationsService(prisma as any);

        const res = await svc.getForUser('user1');

        expect(res.datadog.notificationsEnabled).toBe(false);
        // o outro fica default ON
        expect(res.pagerduty.notificationsEnabled).toBe(true);

        expect(res.datadog.lastSavedAt).toBe('2025-01-01T00:00:00.000Z');
    });

    it('setEnabledForUser calls upsert and returns getForUser', async () => {
        const prisma = makePrismaMock();

        prisma.integrationSetting.upsert.mockResolvedValueOnce({});
        prisma.integrationSetting.createMany.mockResolvedValue({ count: 0 });
        prisma.integrationSetting.findMany.mockResolvedValueOnce([
            {
                kind: IntegrationKind.PAGERDUTY,
                notificationsEnabled: false,
                lastSavedAt: new Date('2025-02-02'),
            },
            {
                kind: IntegrationKind.DATADOG,
                notificationsEnabled: true,
                lastSavedAt: null,
            },
        ]);

        const svc = new IntegrationsService(prisma as any);

        const out = await svc.setEnabledForUser('u', IntegrationKind.PAGERDUTY, false);

        expect(prisma.integrationSetting.upsert).toHaveBeenCalled();
        expect(out).toHaveProperty('pagerduty');
        expect(out.pagerduty.notificationsEnabled).toBe(false);
    });

    it('isEnabled defaults to ON when row missing', async () => {
        const prisma = makePrismaMock();
        prisma.integrationSetting.findUnique.mockResolvedValueOnce(null);

        const svc = new IntegrationsService(prisma as any);
        expect(await svc.isEnabled('u', IntegrationKind.DATADOG)).toBe(true);
    });

    it('isEnabled reflects saved value', async () => {
        const prisma = makePrismaMock();
        prisma.integrationSetting.findUnique.mockResolvedValueOnce({ notificationsEnabled: false });

        const svc = new IntegrationsService(prisma as any);
        expect(await svc.isEnabled('u', IntegrationKind.DATADOG)).toBe(false);
    });
});
