// prisma/seed.incidents.ts
import {
    PrismaClient,
    Provider,
    TimelineEventType,
    IncidentStatus,
    Severity,
    CAPAStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

// -------- Config --------
const SEED_PREFIX = process.env.SEED_PREFIX ?? "TestSeed:";
const TARGET = Number.parseInt(process.env.SEED_COUNT ?? "500", 10);

// "today" = 15/12/2025 por default, window = last 30 days
const BASE_DATE_STR = process.env.SEED_BASE_DATE ?? "2025-12-15";
const WINDOW_DAYS = Number.parseInt(process.env.SEED_WINDOW_DAYS ?? "30", 10);

// ✅ RESET só quando pedires explicitamente
const RESET =
    process.env.SEED_RESET === "1" ||
    process.env.SEED_RESET === "true" ||
    process.env.SEED_RESET === "yes";

// ✅ IMPORTANT: não uses Date.now() por default — tornava cada run “diferente”
// (mantém determinístico para idempotência)
const RUN_ID = process.env.SEED_RUN_ID ?? "default";

// -------- Time helpers (UTC for determinism) --------
function baseDateUtc(): Date {
    return new Date(`${BASE_DATE_STR}T12:00:00.000Z`);
}
function dayBucketUtc(dayOffset: number): Date {
    const d = baseDateUtc();
    d.setUTCDate(d.getUTCDate() - dayOffset);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}
function minutesAfter(base: Date, minutes: number) {
    return new Date(base.getTime() + minutes * 60_000);
}
function hoursAfter(base: Date, hours: number) {
    return new Date(base.getTime() + hours * 3_600_000);
}
function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

// -------- Deterministic pseudo-random (LCG) --------
function lcg01(seed: number) {
    const m = 233280;
    const a = 9301;
    const c = 49297;
    const x = (seed * a + c) % m;
    return x / m;
}
function pick<T>(arr: T[], idx: number): T {
    return arr[idx % arr.length];
}
function pickWeighted<T>(items: Array<{ item: T; weight: number }>, r: number): T {
    const total = items.reduce((s, it) => s + it.weight, 0);
    let t = r * total;
    for (const it of items) {
        t -= it.weight;
        if (t <= 0) return it.item;
    }
    return items[items.length - 1].item;
}

// -------- DB prerequisites --------
async function getUsersStrict() {
    const emails = [
        "marta.correia@netwave.local",
        "rui.figueiredo@netwave.local",
        "ana.lopes@netwave.local",
        "daniel.rocha@netwave.local",
        "sofia.almeida@netwave.local",
    ];

    const found = await prisma.user.findMany({ where: { email: { in: emails } } });
    const byEmail = new Map(found.map((u) => [u.email, u]));

    for (const e of emails) {
        if (!byEmail.get(e)) {
            throw new Error(
                `User não encontrado: ${e}. Corre primeiro o teu seed.ts base (personas).`,
            );
        }
    }

    return {
        marta: byEmail.get("marta.correia@netwave.local")!,
        rui: byEmail.get("rui.figueiredo@netwave.local")!,
        ana: byEmail.get("ana.lopes@netwave.local")!,
        daniel: byEmail.get("daniel.rocha@netwave.local")!,
        sofia: byEmail.get("sofia.almeida@netwave.local")!,
    };
}

async function resetSeededIncidents() {
    // ⚠️ só apaga incidentes SEEDADOS (prefix), não mexe nos reais
    const seeded = await prisma.incident.findMany({
        where: { title: { startsWith: SEED_PREFIX } },
        select: { id: true },
    });
    const ids = seeded.map((x) => x.id);
    if (ids.length === 0) return;

    await prisma.notificationSubscription.deleteMany({ where: { incidentId: { in: ids } } });
    await prisma.incidentSource.deleteMany({ where: { incidentId: { in: ids } } });
    await prisma.incidentTimelineEvent.deleteMany({ where: { incidentId: { in: ids } } });
    await prisma.incidentComment.deleteMany({ where: { incidentId: { in: ids } } });
    await prisma.cAPA.deleteMany({ where: { incidentId: { in: ids } } });
    await prisma.categoryOnIncident.deleteMany({ where: { incidentId: { in: ids } } });
    await prisma.incident.deleteMany({ where: { id: { in: ids } } });

    console.log(`Reset ok: removidos ${ids.length} incidentes (${SEED_PREFIX}*)`);
}

async function ensureTags() {
    const labels = [
        "customer-impact",
        "internal-only",
        "rollback",
        "feature-flag",
        "db-locks",
        "network",
        "security",
        "pii",
        "partner",
        "degraded",
        "maintenance",
        "postmortem-needed",
    ];

    for (const label of labels) {
        await prisma.tag.upsert({ where: { label }, create: { label }, update: {} });
    }
}

async function ensureIntegrationSources() {
    // isto é idempotente por design (upsert)
    const upsert = async (provider: Provider, name: string, baseUrl?: string) => {
        const existing = await prisma.integrationSource.findFirst({ where: { provider, name } });
        if (existing) {
            return prisma.integrationSource.update({
                where: { id: existing.id },
                data: { baseUrl: baseUrl ?? existing.baseUrl },
            });
        }
        return prisma.integrationSource.create({ data: { provider, name, baseUrl } });
    };

    const datadog = await upsert(Provider.DATADOG, "Datadog - Prod", "https://app.datadoghq.com");
    const prometheus = await upsert(
        Provider.PROMETHEUS,
        "Prometheus - Prod",
        "https://prometheus.netwave.local",
    );
    const nagios = await upsert(Provider.NAGIOS, "Nagios - Core", "https://nagios.netwave.local");

    return { datadog, prometheus, nagios };
}

// -------- Scenarios --------
type Scenario = {
    title: string;
    description: string;
    categoryNames: string[];
    tagLabels: string[];
    serviceKeys: string[];
    provider?: Provider;
    severityBias?: Severity[];
};

const TEAM_NAMES = ["IT Ops", "NOC", "SRE", "Service Desk", "Compliance & Risk"] as const;
type TeamName = (typeof TEAM_NAMES)[number];

function statusByAge(ageDays: number, r: number): IncidentStatus {
    if (ageDays <= 1)
        return r < 0.35
            ? IncidentStatus.NEW
            : r < 0.7
                ? IncidentStatus.TRIAGED
                : IncidentStatus.IN_PROGRESS;

    if (ageDays <= 4) {
        if (r < 0.1) return IncidentStatus.NEW;
        if (r < 0.3) return IncidentStatus.TRIAGED;
        if (r < 0.65) return IncidentStatus.IN_PROGRESS;
        if (r < 0.8) return IncidentStatus.ON_HOLD;
        return IncidentStatus.RESOLVED;
    }

    if (ageDays <= 10) {
        if (r < 0.1) return IncidentStatus.ON_HOLD;
        if (r < 0.35) return IncidentStatus.IN_PROGRESS;
        if (r < 0.75) return IncidentStatus.RESOLVED;
        if (r < 0.9) return IncidentStatus.CLOSED;
        return IncidentStatus.REOPENED;
    }

    if (r < 0.65) return IncidentStatus.CLOSED;
    if (r < 0.9) return IncidentStatus.RESOLVED;
    return IncidentStatus.REOPENED;
}

function severityFor(team: TeamName, ageDays: number, isSpike: boolean, r: number, bias?: Severity[]) {
    if (bias && bias.length) {
        const s = pick(bias, Math.floor(r * 10_000));
        if (isSpike && (s === Severity.SEV3 || s === Severity.SEV4) && r < 0.25) return Severity.SEV2;
        return s;
    }

    if (team === "Compliance & Risk") {
        if (isSpike && r < 0.25) return Severity.SEV1;
        return r < 0.2 ? Severity.SEV1 : r < 0.65 ? Severity.SEV2 : Severity.SEV3;
    }
    if (team === "Service Desk") {
        return r < 0.65 ? Severity.SEV4 : r < 0.9 ? Severity.SEV3 : Severity.SEV2;
    }
    if (team === "SRE") {
        if (isSpike && r < 0.2) return Severity.SEV1;
        return r < 0.2 ? Severity.SEV2 : r < 0.75 ? Severity.SEV3 : Severity.SEV2;
    }
    if (team === "NOC") {
        return r < 0.2 ? Severity.SEV2 : r < 0.8 ? Severity.SEV3 : Severity.SEV4;
    }
    if (isSpike && r < 0.15) return Severity.SEV1;
    return r < 0.3 ? Severity.SEV2 : r < 0.85 ? Severity.SEV3 : Severity.SEV4;
}

function buildDayCounts(): number[] {
    const counts: number[] = [];
    const spikeOffsets = new Set([2, 7, 13, 21]);

    for (let d = 0; d < WINDOW_DAYS; d++) {
        const date = dayBucketUtc(d);
        const dow = date.getUTCDay();

        let base = dow === 0 ? 10 : dow === 6 ? 12 : 18;

        const recencyBoost = Math.round(((WINDOW_DAYS - 1 - d) / (WINDOW_DAYS - 1)) * 6) - 2;
        base += recencyBoost;
        base += (d % 5) - 2;

        if (spikeOffsets.has(d)) base += d === 7 ? 45 : d === 13 ? 35 : 25;

        counts.push(Math.max(6, base));
    }

    let sum = counts.reduce((a, b) => a + b, 0);

    if (sum !== TARGET) {
        const factor = TARGET / sum;
        for (let i = 0; i < counts.length; i++) {
            counts[i] = Math.max(3, Math.round(counts[i] * factor));
        }
        sum = counts.reduce((a, b) => a + b, 0);
    }

    let idx = 0;
    while (sum < TARGET) {
        counts[idx % counts.length] += 1;
        sum += 1;
        idx++;
    }
    idx = 0;
    while (sum > TARGET) {
        const k = idx % counts.length;
        if (counts[k] > 3) {
            counts[k] -= 1;
            sum -= 1;
        }
        idx++;
    }

    return counts;
}

// -------- Main --------
async function main() {
    // ✅ Idempotência:
    // - Por defeito não apaga nada
    // - Se já existirem incidentes seedados (prefix), faz SKIP e sai
    // - Se quiseres recriar, usa SEED_RESET=true
    if (RESET) await resetSeededIncidents();

    const existing = await prisma.incident.count({
        where: { title: { startsWith: SEED_PREFIX } },
    });

    if (!RESET && existing > 0) {
        console.log(
            `Seed incidents SKIP: já existem ${existing} incidentes (${SEED_PREFIX}*). ` +
            `Usa SEED_RESET=true para apagar e recriar.`,
        );
        return;
    }

    const U = await getUsersStrict();
    await ensureTags();
    const integrations = await ensureIntegrationSources();

    const teams = await prisma.team.findMany({ select: { id: true, name: true } });
    const teamByName = new Map(teams.map((t) => [t.name, t.id]));

    const services = await prisma.service.findMany({
        where: { isActive: true },
        select: { id: true, key: true, name: true, ownerTeamId: true },
    });
    if (services.length === 0) throw new Error("Não há services ativos. Corre o seed base.");

    const categories = await prisma.category.findMany({ select: { id: true, name: true } });
    if (categories.length === 0) throw new Error("Não há categories. Corre o seed base.");

    const tags = await prisma.tag.findMany({ select: { id: true, label: true } });

    const catByName = new Map(categories.map((c) => [c.name, c.id]));
    const tagByLabel = new Map(tags.map((t) => [t.label, t.id]));
    const serviceByKey = new Map(services.map((s) => [s.key, s]));

    const personaByTeam: Record<TeamName, { reporterId: string; assigneeId: string }> = {
        "IT Ops": { reporterId: U.marta.id, assigneeId: U.marta.id },
        NOC: { reporterId: U.rui.id, assigneeId: U.rui.id },
        SRE: { reporterId: U.ana.id, assigneeId: U.ana.id },
        "Service Desk": { reporterId: U.daniel.id, assigneeId: U.daniel.id },
        "Compliance & Risk": { reporterId: U.sofia.id, assigneeId: U.sofia.id },
    };

    const scenariosByTeam: Record<TeamName, Scenario[]> = {
        "IT Ops": [
            {
                title: "Public API — Erros 5xx pós-deploy",
                description: "Spike de 5xx após deploy. Mitigação via rollback e análise de regressão.",
                categoryNames: ["Erros 5xx", "Falha de deploy"],
                tagLabels: ["customer-impact", "rollback", "postmortem-needed"],
                serviceKeys: ["public-api", "api-gateway"],
                provider: Provider.DATADOG,
                severityBias: [Severity.SEV2, Severity.SEV2, Severity.SEV3, Severity.SEV3, Severity.SEV4],
            },
            {
                title: "DNS/CDN — Degradação e timeouts",
                description: "Falhas intermitentes a causar timeouts. Investigação de upstream e cache.",
                categoryNames: ["Incidente de rede", "Timeouts"],
                tagLabels: ["network", "degraded"],
                serviceKeys: ["dns", "cdn", "load-balancer"],
                provider: Provider.NAGIOS,
                severityBias: [Severity.SEV2, Severity.SEV3, Severity.SEV3, Severity.SEV4],
            },
            {
                title: "Feature Flags — Configuração errada",
                description: "Flag/rollout mal configurado a degradar a experiência. Mitigar com flag off.",
                categoryNames: ["Configuração errada"],
                tagLabels: ["feature-flag", "rollback"],
                serviceKeys: ["feature-flags", "web-app"],
                provider: Provider.DATADOG,
                severityBias: [Severity.SEV3, Severity.SEV3, Severity.SEV4, Severity.SEV2],
            },
        ],
        NOC: [
            {
                title: "NOC — Timeouts em rotas críticas",
                description: "Aumento de timeouts observado pelo NOC. Escala conforme impacto.",
                categoryNames: ["Incidente de rede", "Timeouts"],
                tagLabels: ["network", "customer-impact"],
                serviceKeys: ["load-balancer", "api-gateway", "cdn"],
                provider: Provider.NAGIOS,
                severityBias: [Severity.SEV2, Severity.SEV3, Severity.SEV3, Severity.SEV4],
            },
            {
                title: "Observabilidade — Alertas de latência",
                description: "Picos de latência em endpoints. Validar se é incidente real ou falso positivo.",
                categoryNames: ["Latência alta"],
                tagLabels: ["degraded"],
                serviceKeys: ["dashboards", "metrics", "tracing"],
                provider: Provider.PROMETHEUS,
                severityBias: [Severity.SEV3, Severity.SEV3, Severity.SEV2, Severity.SEV4],
            },
        ],
        SRE: [
            {
                title: "PostgreSQL — Locks e contenção",
                description: "Contenção/locks em queries. Mitigação com tuning e análise de queries.",
                categoryNames: ["Incidente de base de dados", "Latência alta"],
                tagLabels: ["db-locks", "internal-only", "postmortem-needed"],
                serviceKeys: ["postgres"],
                provider: Provider.PROMETHEUS,
                severityBias: [Severity.SEV2, Severity.SEV3, Severity.SEV3, Severity.SEV2, Severity.SEV1],
            },
            {
                title: "Kubernetes — Pods crashloop",
                description: "CrashLoopBackOff em workloads críticos. Reverter config e analisar rollout.",
                categoryNames: ["Configuração errada", "Falha de deploy"],
                tagLabels: ["rollback", "internal-only"],
                serviceKeys: ["kubernetes", "service-mesh"],
                provider: Provider.DATADOG,
                severityBias: [Severity.SEV3, Severity.SEV3, Severity.SEV2, Severity.SEV1],
            },
            {
                title: "Redis — Evictions / cache thrash",
                description: "Evictions e latência em cache. Ajustar TTLs e tamanho de payload.",
                categoryNames: ["Incidente de cache", "Configuração errada"],
                tagLabels: ["maintenance", "internal-only"],
                serviceKeys: ["redis"],
                provider: Provider.PROMETHEUS,
                severityBias: [Severity.SEV3, Severity.SEV3, Severity.SEV2],
            },
        ],
        "Service Desk": [
            {
                title: "Helpdesk — Integração externa lenta",
                description: "Integração externa a degradar o fluxo de tickets. Monitorizar e escalar.",
                categoryNames: ["Integração externa", "Latência alta"],
                tagLabels: ["partner", "degraded"],
                serviceKeys: ["helpdesk"],
                severityBias: [Severity.SEV4, Severity.SEV4, Severity.SEV3, Severity.SEV2],
            },
            {
                title: "Status Page — Atualização falhada",
                description: "Página de status não reflete o estado correto. Afeta comunicação ao cliente.",
                categoryNames: ["Configuração errada"],
                tagLabels: ["customer-impact"],
                serviceKeys: ["status-page"],
                severityBias: [Severity.SEV4, Severity.SEV4, Severity.SEV3],
            },
        ],
        "Compliance & Risk": [
            {
                title: "Audit Trail — Possível PII em logs",
                description: "Deteção de payload com PII em logs. Mitigação com redaction e evidências.",
                categoryNames: ["Incidente com PII", "Incidente de segurança"],
                tagLabels: ["pii", "security", "postmortem-needed"],
                serviceKeys: ["audit-trail", "logs"],
                provider: Provider.DATADOG,
                severityBias: [Severity.SEV1, Severity.SEV2, Severity.SEV2, Severity.SEV3],
            },
            {
                title: "SSO/IAM — Acessos anómalos",
                description: "Padrões suspeitos de autenticação. Verificar origem e aplicar mitigação.",
                categoryNames: ["Incidente de segurança"],
                tagLabels: ["security"],
                serviceKeys: ["iam-sso", "auth-gateway"],
                provider: Provider.DATADOG,
                severityBias: [Severity.SEV2, Severity.SEV2, Severity.SEV3, Severity.SEV1],
            },
        ],
    };

    const teamWeights: Array<{ item: TeamName; weight: number }> = [
        { item: "SRE", weight: 0.28 },
        { item: "IT Ops", weight: 0.24 },
        { item: "NOC", weight: 0.2 },
        { item: "Service Desk", weight: 0.18 },
        { item: "Compliance & Risk", weight: 0.1 },
    ];

    const dayCounts = buildDayCounts();
    const spikeOffsets = new Set([2, 7, 13, 21]);

    let globalIdx = 0;

    for (let dayOffset = 0; dayOffset < WINDOW_DAYS; dayOffset++) {
        const bucketStart = dayBucketUtc(dayOffset);
        const dailyTotal = dayCounts[dayOffset];
        const isSpike = spikeOffsets.has(dayOffset);

        for (let k = 0; k < dailyTotal; k++) {
            globalIdx++;

            const r1 = lcg01(globalIdx * 17 + 3);
            const r2 = lcg01(globalIdx * 31 + 7);
            const r3 = lcg01(globalIdx * 61 + 11);

            const teamName = pickWeighted(teamWeights, r1);
            const teamId = teamByName.get(teamName) ?? null;

            const persona = personaByTeam[teamName];
            const scenarios = scenariosByTeam[teamName];
            const scenario = pick(scenarios, Math.floor(r2 * 10_000));

            const minuteOfDay = (k * 17 + dayOffset * 13 + Math.floor(r3 * 120)) % (24 * 60);
            const createdAt = minutesAfter(bucketStart, minuteOfDay);

            const status = statusByAge(dayOffset, r2);
            const severity = severityFor(teamName, dayOffset, isSpike, r3, scenario.severityBias);

            const svc =
                serviceByKey.get(pick(scenario.serviceKeys, globalIdx)) ??
                services.find((s) => teamId && s.ownerTeamId === teamId) ??
                pick(services, globalIdx);

            const triageMins = clamp(8 + Math.floor(r1 * 25), 5, 60);

            const triagedAt = status === IncidentStatus.NEW ? null : minutesAfter(createdAt, triageMins);
            const inProgressAt =
                status === IncidentStatus.NEW || status === IncidentStatus.TRIAGED
                    ? null
                    : minutesAfter(createdAt, triageMins + 10);

            const mttrHoursBase = isSpike ? 8 : 3;
            const sevBoost =
                severity === Severity.SEV1 ? 10 : severity === Severity.SEV2 ? 6 : severity === Severity.SEV3 ? 3 : 1;
            const mttrHours = clamp(mttrHoursBase + sevBoost + Math.floor(r3 * 6), 1, 24);

            const resolvedAt =
                status === IncidentStatus.RESOLVED || status === IncidentStatus.CLOSED || status === IncidentStatus.REOPENED
                    ? hoursAfter(createdAt, mttrHours)
                    : null;

            const closedAt =
                status === IncidentStatus.CLOSED && resolvedAt ? hoursAfter(resolvedAt, 4 + Math.floor(r1 * 10)) : null;

            const reopenAt =
                status === IncidentStatus.REOPENED && resolvedAt ? hoursAfter(resolvedAt, 2 + Math.floor(r2 * 12)) : null;

            const categoryCreates = scenario.categoryNames
                .map((n) => catByName.get(n))
                .filter((id): id is string => Boolean(id))
                .map((id) => ({ category: { connect: { id } } }));

            const tagConnects = scenario.tagLabels
                .map((l) => tagByLabel.get(l))
                .filter((id): id is string => Boolean(id))
                .map((id) => ({ id }));

            const withSource = Boolean(scenario.provider) && r1 < 0.7;
            const integrationId =
                scenario.provider === Provider.DATADOG
                    ? integrations.datadog.id
                    : scenario.provider === Provider.PROMETHEUS
                        ? integrations.prometheus.id
                        : scenario.provider === Provider.NAGIOS
                            ? integrations.nagios.id
                            : null;

            const externalId = `${SEED_PREFIX.toLowerCase()}-${RUN_ID}-d${dayOffset}-k${k}-g${globalIdx}-${teamName}-${svc.key}-${scenario.provider ?? "none"}`;

            const withCapa =
                (severity === Severity.SEV1 || severity === Severity.SEV2) &&
                (status === IncidentStatus.RESOLVED || status === IncidentStatus.CLOSED) &&
                r2 < 0.35;

            const title = `${SEED_PREFIX} ${teamName} — ${scenario.title} (${severity}) [${BASE_DATE_STR} -${dayOffset}d]`;

            const timelineCreates: any[] = [];

            if (triagedAt) {
                timelineCreates.push({
                    type: TimelineEventType.STATUS_CHANGE,
                    authorId: persona.reporterId,
                    fromStatus: IncidentStatus.NEW,
                    toStatus: IncidentStatus.TRIAGED,
                    createdAt: triagedAt,
                });
                timelineCreates.push({
                    type: TimelineEventType.ASSIGNMENT,
                    authorId: persona.reporterId,
                    message: `Assigned to ${teamName}`,
                    createdAt: minutesAfter(triagedAt, 2),
                });
            }

            if (inProgressAt) {
                timelineCreates.push({
                    type: TimelineEventType.STATUS_CHANGE,
                    authorId: persona.assigneeId,
                    fromStatus: IncidentStatus.TRIAGED,
                    toStatus: IncidentStatus.IN_PROGRESS,
                    createdAt: inProgressAt,
                });
                timelineCreates.push({
                    type: TimelineEventType.FIELD_UPDATE,
                    authorId: persona.assigneeId,
                    message: `Investigating ${svc.key}. Evidence gathered (logs/metrics/traces).`,
                    createdAt: minutesAfter(inProgressAt, 12),
                });
            }

            if (status === IncidentStatus.ON_HOLD && inProgressAt) {
                const holdAt = minutesAfter(inProgressAt, 45 + Math.floor(r3 * 180));
                timelineCreates.push({
                    type: TimelineEventType.STATUS_CHANGE,
                    authorId: persona.assigneeId,
                    fromStatus: IncidentStatus.IN_PROGRESS,
                    toStatus: IncidentStatus.ON_HOLD,
                    createdAt: holdAt,
                });
                timelineCreates.push({
                    type: TimelineEventType.COMMENT,
                    authorId: persona.assigneeId,
                    message: "On hold: aguardando janela de manutenção / dependência externa.",
                    createdAt: minutesAfter(holdAt, 5),
                });
            }

            if (resolvedAt && (status === IncidentStatus.RESOLVED || status === IncidentStatus.CLOSED)) {
                timelineCreates.push({
                    type: TimelineEventType.COMMENT,
                    authorId: persona.assigneeId,
                    message:
                        severity === Severity.SEV1 || severity === Severity.SEV2
                            ? "Mitigation applied. Monitoring recovery + comms updated."
                            : "Mitigation applied. Monitoring stable.",
                    createdAt: minutesAfter(resolvedAt, -20),
                });
                timelineCreates.push({
                    type: TimelineEventType.STATUS_CHANGE,
                    authorId: persona.assigneeId,
                    fromStatus: IncidentStatus.IN_PROGRESS,
                    toStatus: IncidentStatus.RESOLVED,
                    createdAt: resolvedAt,
                });
            }

            if (closedAt) {
                timelineCreates.push({
                    type: TimelineEventType.STATUS_CHANGE,
                    authorId: U.marta.id,
                    fromStatus: IncidentStatus.RESOLVED,
                    toStatus: IncidentStatus.CLOSED,
                    createdAt: closedAt,
                });
            }

            if (status === IncidentStatus.REOPENED && resolvedAt && reopenAt) {
                timelineCreates.push({
                    type: TimelineEventType.STATUS_CHANGE,
                    authorId: persona.assigneeId,
                    fromStatus: IncidentStatus.IN_PROGRESS,
                    toStatus: IncidentStatus.RESOLVED,
                    createdAt: resolvedAt,
                });
                timelineCreates.push({
                    type: TimelineEventType.STATUS_CHANGE,
                    authorId: persona.reporterId,
                    fromStatus: IncidentStatus.RESOLVED,
                    toStatus: IncidentStatus.REOPENED,
                    createdAt: reopenAt,
                });
                timelineCreates.push({
                    type: TimelineEventType.COMMENT,
                    authorId: persona.reporterId,
                    message: "Issue recurred after initial mitigation. Reopening for deeper root cause.",
                    createdAt: minutesAfter(reopenAt, 3),
                });
            }

            const commentCreates: any[] = [
                {
                    authorId: persona.reporterId,
                    body: "Nota inicial (seed): impacto/sintomas + contexto mínimo.",
                    createdAt: minutesAfter(createdAt, 12),
                },
            ];

            if (status !== IncidentStatus.NEW) {
                commentCreates.push({
                    authorId: persona.assigneeId,
                    body: "Atualização (seed): análise em curso; runbook seguido; recolhidas métricas/logs/traces.",
                    createdAt: minutesAfter(createdAt, 60 + Math.floor(r1 * 90)),
                });
            }

            if ((severity === Severity.SEV1 || severity === Severity.SEV2) && r3 < 0.5) {
                commentCreates.push({
                    authorId: U.daniel.id,
                    body: "Service Desk: clientes a reportar impacto. Comms preparadas/atualizadas.",
                    createdAt: minutesAfter(createdAt, 90 + Math.floor(r2 * 120)),
                });
            }

            await prisma.incident.create({
                data: {
                    title,
                    description: scenario.description,
                    status,
                    severity,

                    reporterId: persona.reporterId,
                    assigneeId: status === IncidentStatus.NEW ? null : persona.assigneeId,
                    teamId,
                    primaryServiceId: svc.id,

                    triagedAt,
                    inProgressAt,
                    resolvedAt,
                    closedAt,

                    createdAt,

                    categories: categoryCreates.length ? { create: categoryCreates } : undefined,
                    tags: tagConnects.length ? { connect: tagConnects } : undefined,

                    sources:
                        withSource && integrationId
                            ? {
                                create: [
                                    {
                                        integrationId,
                                        externalId,
                                        payload: {
                                            seed: true,
                                            runId: RUN_ID,
                                            date: bucketStart.toISOString().slice(0, 10),
                                            team: teamName,
                                            serviceKey: svc.key,
                                            hint: scenario.title,
                                            signal:
                                                scenario.provider === Provider.DATADOG
                                                    ? "apm/5xx/latency"
                                                    : scenario.provider === Provider.PROMETHEUS
                                                        ? "metrics/rules"
                                                        : "checks",
                                        },
                                    },
                                ],
                            }
                            : undefined,

                    timeline: timelineCreates.length ? { create: timelineCreates } : undefined,
                    comments: { create: commentCreates },

                    capas: withCapa
                        ? {
                            create: [
                                {
                                    action:
                                        "CAPA: melhorar prevenção/deteção (runbook + alerting + guardrails de deploy/config).",
                                    status: r1 < 0.5 ? CAPAStatus.IN_PROGRESS : CAPAStatus.OPEN,
                                    ownerId: persona.assigneeId,
                                    dueAt: hoursAfter(createdAt, 24 * (5 + Math.floor(r2 * 10))),
                                },
                            ],
                        }
                        : undefined,

                    subscriptions: {
                        create: [
                            { userId: persona.reporterId },
                            ...(status === IncidentStatus.NEW ? [] : [{ userId: persona.assigneeId }]),
                            ...(severity === Severity.SEV1 || severity === Severity.SEV2 ? [{ userId: U.marta.id }] : []),
                        ],
                    },
                },
            });
        }
    }

    const total = dayCounts.reduce((a, b) => a + b, 0);
    console.log(
        `Seed incidents OK: ${total} incidentes | window=${WINDOW_DAYS} dias | base=${BASE_DATE_STR} | prefix=${SEED_PREFIX} | RUN_ID=${RUN_ID}`,
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
