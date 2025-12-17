import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IntegrationsService } from '../../src/integrations/integrations.service';
import { IntegrationKind } from '@prisma/client';
import { resetDb } from './_helpers/prisma-reset';

describe('IntegrationsService (integration)', () => {
    let prisma: PrismaService;
    let svc: IntegrationsService;
    let app: any;

    beforeAll(async () => {
        const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
        app = mod.createNestApplication();
        await app.init();

        prisma = app.get(PrismaService);
        svc = app.get(IntegrationsService);
    });

    afterAll(async () => {
        await app?.close();
    });

    beforeEach(async () => {
        await resetDb(prisma);
    });

    it('getForUser ensures defaults in DB and returns defaults (ON)', async () => {
        const u = await prisma.user.create({
            data: { email: 'a@a.com', name: 'A', password: 'x' },
        });

        const res = await svc.getForUser(u.id);

        expect(res.datadog.notificationsEnabled).toBe(true);
        expect(res.pagerduty.notificationsEnabled).toBe(true);

        const rows = await prisma.integrationSetting.findMany({ where: { userId: u.id } });
        expect(rows.length).toBe(2);
    });

    it('setEnabledForUser upserts and does not create duplicates', async () => {
        const u = await prisma.user.create({
            data: { email: 'b@b.com', name: 'B', password: 'x' },
        });

        await svc.setEnabledForUser(u.id, IntegrationKind.DATADOG, true);
        await svc.setEnabledForUser(u.id, IntegrationKind.DATADOG, false);
        await svc.setEnabledForUser(u.id, IntegrationKind.DATADOG, true);

        const rows = await prisma.integrationSetting.findMany({
            where: { userId: u.id, kind: IntegrationKind.DATADOG },
        });

        expect(rows.length).toBe(1);
        expect(rows[0].notificationsEnabled).toBe(true);
        expect(rows[0].lastSavedAt).toBeTruthy();

        // e continua a haver 2 settings no total
        const all = await prisma.integrationSetting.findMany({ where: { userId: u.id } });
        expect(all.length).toBe(2);
    });

    it('isEnabled defaults to ON if row missing', async () => {
        const u = await prisma.user.create({
            data: { email: 'c@c.com', name: 'C', password: 'x' },
        });

        // ainda não chamámos getForUser, portanto pode não haver row
        const enabled = await svc.isEnabled(u.id, IntegrationKind.PAGERDUTY);
        expect(enabled).toBe(true);
    });

    it('isEnabled reflects saved value', async () => {
        const u = await prisma.user.create({
            data: { email: 'd@d.com', name: 'D', password: 'x' },
        });

        await svc.setEnabledForUser(u.id, IntegrationKind.PAGERDUTY, false);
        expect(await svc.isEnabled(u.id, IntegrationKind.PAGERDUTY)).toBe(false);

        await svc.setEnabledForUser(u.id, IntegrationKind.PAGERDUTY, true);
        expect(await svc.isEnabled(u.id, IntegrationKind.PAGERDUTY)).toBe(true);
    });
});
