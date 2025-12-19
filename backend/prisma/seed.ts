/**
 * @file backend/prisma/seed.ts
 * @module Backend.Persistence.Seed.Base
 *
 * @summary
 *  - Seed base (idempotente) do IMS: cria/garante Teams, Users (personas), Services e Categories.
 *
 * @description
 *  Este seed é o “bootstrap” mínimo do sistema e serve como pré-requisito para seeds mais ricas,
 * como `seed.incidents.ts`, que assume que:
 *  - as personas existem (por email fixo)
 *  - as equipas existem (por name fixo)
 *  - há serviços ativos e categorias para associar aos incidentes
 *
 *  Estratégia:
 *   - usa `upsert` em entidades com chaves únicas (team.name, user.email, service.key, category.name)
 *   - reexecutar não duplica, apenas atualiza campos descritivos quando necessário
 *
 * @security
 *  - DEFAULT_PASSWORD é apenas para dev/demo. Não usar em produção.
 *
 * @data_created
 *  - Team: 5 equipas base
 *  - User: 5 personas (2 ADMIN, 3 USER) ligadas a equipas
 *  - Service: catálogo de componentes (infra, observabilidade, produto, suporte, compliance)
 *  - Category: catálogo de tipos de incidente
 */

import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Password default (dev/demo). Em produção isto deve ser proibido/overridden.
 */
const DEFAULT_PASSWORD = "123456";

type TeamSeed = { name: string };
type UserSeed = {
  email: string;
  name: string;
  role?: Role;
  teamName: string;
  password?: string;
};

type ServiceSeed = {
  key: string;
  name: string;
  description?: string;
  ownerTeamName?: string; // liga ao Team.ownerTeamId
  isActive?: boolean;
};

type CategorySeed = { name: string; description?: string };

async function main() {
  // ---------------------------
  // 1) Teams (alinhadas com as personas)
  // ---------------------------
  const teams: TeamSeed[] = [
    { name: "IT Ops" },
    { name: "NOC" },
    { name: "SRE" },
    { name: "Service Desk" },
    { name: "Compliance & Risk" },
  ];

  const teamIdByName = new Map<string, string>();

  // Idempotência: Team.name é unique, logo upsert impede duplicação.
  for (const t of teams) {
    const team = await prisma.team.upsert({
      where: { name: t.name },
      create: { name: t.name },
      update: {},
    });
    teamIdByName.set(t.name, team.id);
  }

  // ---------------------------
  // 2) Users (Personas)
  // ---------------------------
  const users: UserSeed[] = [
    {
      name: "Marta Correia",
      email: "marta.correia@netwave.local",
      role: Role.ADMIN,
      teamName: "IT Ops",
      password: DEFAULT_PASSWORD,
    },
    {
      name: "Rui Figueiredo",
      email: "rui.figueiredo@netwave.local",
      role: Role.USER,
      teamName: "NOC",
      password: DEFAULT_PASSWORD,
    },
    {
      name: "Ana Lopes",
      email: "ana.lopes@netwave.local",
      role: Role.USER,
      teamName: "SRE",
      password: DEFAULT_PASSWORD,
    },
    {
      name: "Daniel Rocha",
      email: "daniel.rocha@netwave.local",
      role: Role.USER,
      teamName: "Service Desk",
      password: DEFAULT_PASSWORD,
    },
    {
      name: "Sofia Almeida",
      email: "sofia.almeida@netwave.local",
      role: Role.ADMIN,
      teamName: "Compliance & Risk",
      password: DEFAULT_PASSWORD,
    },
  ];

  for (const u of users) {
    const teamId = teamIdByName.get(u.teamName);
    if (!teamId) throw new Error(`Team not found: ${u.teamName}`);

    // Idempotência: User.email é unique.
    // Nota: no update, mantém password existente (não sobrescreve) para evitar surprises.
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        name: u.name,
        password: u.password ?? DEFAULT_PASSWORD,
        role: u.role ?? Role.USER,
        teams: { connect: [{ id: teamId }] },
      },
      update: {
        name: u.name,
        role: u.role ?? Role.USER,
        teams: { set: [{ id: teamId }] },
      },
    });
  }

  // ---------------------------
  // 3) Services (componentes/sistemas afetados)
  // ---------------------------
  const services: ServiceSeed[] = [
    // Core (muito usado nos cenários)
    { key: "auth-gateway", name: "Auth Gateway", description: "Gateway de autenticação / tokens", ownerTeamName: "SRE" },
    { key: "public-api", name: "Public API", description: "API pública principal", ownerTeamName: "IT Ops" },
    { key: "api-gateway", name: "API Gateway", description: "Gateway/roteamento/rate limiting", ownerTeamName: "IT Ops" },

    // Plataforma/Infra
    { key: "dns", name: "DNS", description: "Resolução de nomes", ownerTeamName: "IT Ops" },
    { key: "cdn", name: "CDN", description: "Entrega e cache na edge", ownerTeamName: "IT Ops" },
    { key: "load-balancer", name: "Load Balancer", description: "Balanceamento L4/L7", ownerTeamName: "IT Ops" },
    { key: "kubernetes", name: "Kubernetes Cluster", description: "Cluster principal", ownerTeamName: "SRE" },
    { key: "service-mesh", name: "Service Mesh", description: "mTLS / routing interno", ownerTeamName: "SRE" },

    // Dados
    { key: "postgres", name: "PostgreSQL", description: "Base de dados transacional", ownerTeamName: "SRE" },
    { key: "redis", name: "Redis", description: "Cache / sessões / filas leves", ownerTeamName: "SRE" },
    { key: "object-storage", name: "Object Storage", description: "Storage de ficheiros (S3 compatível)", ownerTeamName: "IT Ops" },

    // Observabilidade
    { key: "metrics", name: "Metrics (Prometheus)", description: "Métricas e scraping", ownerTeamName: "SRE" },
    { key: "logs", name: "Logs (ELK)", description: "Logs centralizados", ownerTeamName: "SRE" },
    { key: "tracing", name: "Tracing (Tempo/Jaeger)", description: "Traces distribuídos", ownerTeamName: "SRE" },
    { key: "dashboards", name: "Dashboards (Grafana)", description: "Dashboards e alerting", ownerTeamName: "SRE" },

    // CI/CD
    { key: "ci-cd", name: "CI/CD Pipelines", description: "Pipelines de deploy e rollback", ownerTeamName: "SRE" },
    { key: "feature-flags", name: "Feature Flags", description: "Flags e rollout controlado", ownerTeamName: "SRE" },

    // Produto/UI
    { key: "web-app", name: "Web App", description: "App web principal", ownerTeamName: "IT Ops" },
    { key: "admin-portal", name: "Admin Portal", description: "Portal interno", ownerTeamName: "IT Ops" },

    // Suporte/externo
    { key: "helpdesk", name: "Helpdesk (Zendesk)", description: "Tickets e suporte ao cliente", ownerTeamName: "Service Desk" },
    { key: "status-page", name: "Status Page", description: "Página pública de estado", ownerTeamName: "Service Desk" },

    // Segurança/compliance
    { key: "iam-sso", name: "SSO / IAM", description: "Identidade e acesso", ownerTeamName: "Compliance & Risk" },
    { key: "audit-trail", name: "Audit Trail", description: "Registos e evidências", ownerTeamName: "Compliance & Risk" },
  ];

  for (const s of services) {
    const ownerTeamId = s.ownerTeamName ? teamIdByName.get(s.ownerTeamName) : undefined;

    // Idempotência: Service.key é unique.
    await prisma.service.upsert({
      where: { key: s.key },
      create: {
        key: s.key,
        name: s.name,
        description: s.description,
        isActive: s.isActive ?? true,
        ownerTeamId: ownerTeamId ?? null,
      },
      update: {
        name: s.name,
        description: s.description,
        isActive: s.isActive ?? true,
        ownerTeamId: ownerTeamId ?? null,
      },
    });
  }

  // ---------------------------
  // 4) Categories (tipos de problema)
  // ---------------------------
  const categories: CategorySeed[] = [
    { name: "Latência alta", description: "Aumento de latência / degradação de performance" },
    { name: "Erros 5xx", description: "Erros do lado do servidor" },
    { name: "Erros 4xx", description: "Erros do lado do cliente / permissões / auth" },
    { name: "Falha de deploy", description: "Deploy causou regressão / incident" },
    { name: "Timeouts", description: "Requests a expirar / timeouts" },
    { name: "Incidente de base de dados", description: "Locks, conexões, storage, replicação" },
    { name: "Incidente de cache", description: "Redis/down, thrashing, chaves expirar" },
    { name: "Configuração errada", description: "Env/config/feature flag mal definida" },
    { name: "Incidente de rede", description: "DNS, LB, routing, conectividade" },
    { name: "Incidente de segurança", description: "Suspeita de abuso / vulnerabilidade" },
    { name: "Incidente com PII", description: "Dados pessoais envolvidos / compliance" },
    { name: "Integração externa", description: "Falha em provider externo" },
  ];

  for (const c of categories) {
    // Idempotência: Category.name é unique.
    await prisma.category.upsert({
      where: { name: c.name },
      create: { name: c.name, description: c.description },
      update: { description: c.description },
    });
  }

  console.log("Seed concluída: teams, users (personas), services, categories.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
