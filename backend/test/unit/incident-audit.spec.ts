import {
  stableStringify,
  computeHmacSha256Hex,
  buildIncidentAuditPayload,
  computeIncidentAuditHash,
  ensureIncidentAuditHash,
  type PrismaLike,
} from '../../src/audit/incident-audit';

describe('incident-audit (100% coverage)', () => {
  describe('stableStringify', () => {
    it('é determinístico (ordem de keys não muda output) + arrays preservam ordem', () => {
      const a = { b: 1, a: 2, c: { z: 9, y: 8 }, arr: [3, { k: 'v' }, 1] };
      const b = { c: { y: 8, z: 9 }, a: 2, arr: [3, { k: 'v' }, 1], b: 1 };

      expect(stableStringify(a)).toBe(stableStringify(b));
      expect(stableStringify([1, 2, 3])).not.toBe(stableStringify([3, 2, 1]));
    });

    it('serializa Date em ISO e trata null/undefined como "null"', () => {
      const d = new Date('2025-01-01T00:00:00.000Z');
      expect(stableStringify({ d })).toBe(`{"d":"2025-01-01T00:00:00.000Z"}`);
      expect(stableStringify(null)).toBe('null');
      expect(stableStringify(undefined)).toBe('null');
    });

    it('serializa BigInt de forma segura', () => {
      expect(stableStringify({ n: BigInt(10) })).toBe(`{"n":"10"}`);
    });

    it('lança erro em estruturas circulares', () => {
      const obj: any = { a: 1 };
      obj.self = obj;

      expect(() => stableStringify(obj)).toThrow(
        'stableStringify: circular structure',
      );
    });

    it('datas inválidas acabam como null (via ISO)', () => {
      // Date inválida => iso() retorna null
      const bad = new Date('not-a-date');
      expect(stableStringify({ bad })).toBe(`{"bad":null}`);
    });
  });

  describe('computeHmacSha256Hex', () => {
    it('HMAC muda se payload mudar', () => {
      const secret = 's';
      const h1 = computeHmacSha256Hex(secret, 'payload-1');
      const h2 = computeHmacSha256Hex(secret, 'payload-2');
      expect(h1).not.toBe(h2);
      expect(typeof h1).toBe('string');
      expect(h1.length).toBeGreaterThan(10);
    });

    it('lança erro se secret não existir', () => {
      expect(() => computeHmacSha256Hex('', 'x')).toThrow(
        'computeHmacSha256Hex: secret is required',
      );
    });

    it('lança erro se payload for null/undefined', () => {
      expect(() => computeHmacSha256Hex('s', null as any)).toThrow(
        'computeHmacSha256Hex: payload is required',
      );
      expect(() => computeHmacSha256Hex('s', undefined as any)).toThrow(
        'computeHmacSha256Hex: payload is required',
      );
    });
  });

  describe('buildIncidentAuditPayload', () => {
    it('normaliza iso() e ordena collections (categories/tags/timeline/comments/capas/sources)', () => {
      const incident: any = {
        id: 'inc1',
        title: 'T',
        description: 'D',
        status: 'NEW',
        severity: 'SEV3',
        reporterId: 'r1',
        assigneeId: undefined, // vira null
        teamId: undefined, // vira null
        primaryServiceId: undefined, // vira null
        triagedAt: null,
        inProgressAt: undefined,
        resolvedAt: '2025-01-02T00:00:00.000Z',
        closedAt: new Date('2025-01-03T00:00:00.000Z'),
        createdAt: '2025-01-01T00:00:00.000Z',

        categories: [
          { categoryId: 'b', assignedAt: '2025-01-02T00:00:00.000Z', category: { id: 'b', name: 'B' } },
          { categoryId: 'a', assignedAt: '2025-01-01T00:00:00.000Z', category: { id: 'a', name: 'A' } },
        ],
        tags: [
          { id: 't2', label: 'zzz' },
          { id: 't1', label: 'aaa' },
        ],
        timeline: [
          { id: '2', type: 'COMMENT', createdAt: '2025-01-02T00:00:00.000Z', message: 'm2' },
          { id: '1', type: 'COMMENT', createdAt: '2025-01-01T00:00:00.000Z', message: 'm1' },
        ],
        comments: [
          { id: 'c2', body: 'b', authorId: 'u', createdAt: '2025-01-02T00:00:00.000Z' },
          { id: 'c1', body: 'a', authorId: 'u', createdAt: '2025-01-01T00:00:00.000Z' },
        ],
        capas: [
          {
            id: 'cap2',
            action: 'a2',
            status: 'OPEN',
            ownerId: null,
            dueAt: undefined,
            createdAt: '2025-01-02T00:00:00.000Z',
            updatedAt: '2025-01-03T00:00:00.000Z',
          },
          {
            id: 'cap1',
            action: 'a1',
            status: 'DONE',
            ownerId: 'o1',
            dueAt: '2025-01-10T00:00:00.000Z',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-02T00:00:00.000Z',
          },
        ],
        sources: [
          { id: 's2', integrationId: 'int2', externalId: 'b', createdAt: '2025-01-02T00:00:00.000Z' },
          { id: 's1', integrationId: 'int1', externalId: 'a', createdAt: '2025-01-01T00:00:00.000Z' },
        ],
      };

      const payload = buildIncidentAuditPayload(incident);

      // core null-normalization + iso
      expect(payload.incident.assigneeId).toBeNull();
      expect(payload.incident.teamId).toBeNull();
      expect(payload.incident.primaryServiceId).toBeNull();
      expect(payload.incident.triagedAt).toBeNull();
      expect(payload.incident.inProgressAt).toBeNull();
      expect(payload.incident.resolvedAt).toBe('2025-01-02T00:00:00.000Z');
      expect(payload.incident.closedAt).toBe('2025-01-03T00:00:00.000Z');
      expect(payload.incident.createdAt).toBe('2025-01-01T00:00:00.000Z');

      // ordering checks
      expect(payload.categories.map((x: any) => x.categoryId)).toEqual(['a', 'b']);
      expect(payload.tags.map((x: any) => x.label)).toEqual(['aaa', 'zzz']);
      expect(payload.timeline.map((x: any) => x.id)).toEqual(['1', '2']);
      expect(payload.comments.map((x: any) => x.id)).toEqual(['c1', 'c2']);
      expect(payload.capas.map((x: any) => x.id)).toEqual(['cap1', 'cap2']);
      expect(payload.sources.map((x: any) => x.id)).toEqual(['s1', 's2']);
    });

    it('suporta incident “quase vazio” (arrays undefined)', () => {
      const payload = buildIncidentAuditPayload({
        id: 'i',
        title: 't',
        description: 'd',
        status: 'NEW',
        severity: 'SEV3',
        reporterId: 'r',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      } as any);

      expect(payload.categories).toEqual([]);
      expect(payload.tags).toEqual([]);
      expect(payload.timeline).toEqual([]);
      expect(payload.comments).toEqual([]);
      expect(payload.capas).toEqual([]);
      expect(payload.sources).toEqual([]);
    });
  });

  describe('computeIncidentAuditHash', () => {
    it('lança erro se incident não existir', async () => {
      const prisma: PrismaLike = {
        incident: {
          findUnique: jest.fn(async () => null),
          update: jest.fn(async () => ({})),
        },
      };

      await expect(
        computeIncidentAuditHash(prisma, 'missing', 'secret'),
      ).rejects.toThrow('Incident not found for audit');
    });

    it('devolve hash + canonical + payloadObj quando existe', async () => {
      const incident: any = {
        id: 'inc1',
        title: 'T',
        description: 'D',
        status: 'NEW',
        severity: 'SEV3',
        reporterId: 'r1',
        createdAt: '2025-01-01T00:00:00.000Z',
        categories: [],
        tags: [],
        timeline: [],
        comments: [],
        capas: [],
        sources: [],
      };

      const prisma: PrismaLike = {
        incident: {
          findUnique: jest.fn(async () => incident),
          update: jest.fn(async () => ({})),
        },
      };

      const out = await computeIncidentAuditHash(prisma, 'inc1', 'secret');

      expect(prisma.incident.findUnique).toHaveBeenCalled();
      expect(out).toHaveProperty('hash');
      expect(out).toHaveProperty('canonical');
      expect(out).toHaveProperty('payloadObj');
      expect(typeof out.hash).toBe('string');
      expect(out.hash.length).toBeGreaterThan(10);
      expect(typeof out.canonical).toBe('string');
      expect(out.canonical.length).toBeGreaterThan(2);
    });
  });

  describe('ensureIncidentAuditHash', () => {
    it('se secret não existir => retorna null e não faz update', async () => {
      const prisma: PrismaLike = {
        incident: {
          findUnique: jest.fn(async () => ({ id: 'inc1' } as any)),
          update: jest.fn(async () => ({})),
        },
      };

      const out = await ensureIncidentAuditHash(prisma, 'inc1', undefined);

      expect(out).toBeNull();
      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it('com secret => calcula hash e grava auditHash + auditHashUpdatedAt', async () => {
      const incident: any = {
        id: 'inc1',
        title: 'T',
        description: 'D',
        status: 'NEW',
        severity: 'SEV3',
        reporterId: 'r1',
        createdAt: '2025-01-01T00:00:00.000Z',
        categories: [],
        tags: [],
        timeline: [],
        comments: [],
        capas: [],
        sources: [],
      };

      const prisma: PrismaLike = {
        incident: {
          findUnique: jest.fn(async () => incident),
          update: jest.fn(async ({ data }: any) => data),
        },
      };

      const hash = await ensureIncidentAuditHash(prisma, 'inc1', 'secret');

      expect(typeof hash).toBe('string');
      expect(prisma.incident.update).toHaveBeenCalledWith({
        where: { id: 'inc1' },
        data: {
          auditHash: hash,
          auditHashUpdatedAt: expect.any(Date),
        },
      });
    });
  });
});
