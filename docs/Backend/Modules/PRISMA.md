# Prisma Module — Database Access Layer (NestJS + Prisma)

Este documento descreve o módulo `prisma/` do backend IMS: como o Prisma é integrado no NestJS, qual o papel do `PrismaService` e como os restantes módulos usam esta camada para acesso à base de dados.

---

## 1) Estrutura do módulo

Localização: `backend/src/prisma/`

Ficheiros:
- `prisma.module.ts`
- `prisma.service.ts`

---

## 2) Objetivo

O módulo Prisma fornece uma forma consistente e centralizada de:
- inicializar uma instância única de `PrismaClient` para toda a aplicação
- gerir o lifecycle da conexão à base de dados (connect/disconnect)
- permitir injeção do Prisma em qualquer serviço/controller do NestJS

Na prática, isto torna o Prisma o “data access layer” do backend.

---

## 3) PrismaModule (Global)

Ficheiro: `prisma.module.ts`

Características:
- é anotado com `@Global()`
- regista `PrismaService` em `providers`
- exporta `PrismaService` em `exports`

Efeito:
- qualquer módulo consegue injetar `PrismaService` sem ter de importar explicitamente `PrismaModule` em cada módulo.
- reduz boilerplate e simplifica a composição de módulos.

---

## 4) PrismaService (Lifecycle + PrismaClient)

Ficheiro: `prisma.service.ts`

O `PrismaService`:
- estende `PrismaClient`
- implementa:
  - `OnModuleInit` — para conectar ao arrancar
  - `OnModuleDestroy` — para desconectar ao encerrar

### 4.1 `onModuleInit()`
- chama `this.$connect()`
- garante que a app arranca com a ligação estabelecida

### 4.2 `onModuleDestroy()`
- chama `this.$disconnect()`
- garante shutdown limpo e evita conexões penduradas em testes/CI e em ambiente real

---

## 5) Configuração esperada

### 5.1 DATABASE_URL
A ligação ao Postgres é configurada através do Prisma, tipicamente por:
- `DATABASE_URL` (env var)

Esta variável é usada pelo Prisma Client para conectar à base de dados definida no schema.

---

## 6) Como é usado nos serviços

Exemplo de injeção num service:
```ts
constructor(private prisma: PrismaService) {}
```

E depois uso direto dos modelos Prisma:
```ts
await this.prisma.incident.findMany({ where: { status: "NEW" } });
```

Isto permite que os serviços implementem regras de negócio enquanto o Prisma trata de:
- queries
- transações (`$transaction`)
- includes/relations
- validação de constraints ao nível da base de dados

---

## 7) Considerações de qualidade

- Single instance: o provider singleton do Nest evita múltiplas instâncias do PrismaClient.
- Lifecycle controlado: a conexão abre/fecha de forma previsível.
- Facilita testes: a aplicação em testes (unit/integration/e2e) tem menos risco de “hanging handles” ao terminar.

---

## 8) Tests associados (referência)

Não foram fornecidos os testes específicos do Prisma neste momento.
Em projetos NestJS é comum existirem testes indiretos (via módulos que usam Prisma), por exemplo:
- testes de integração que correm queries reais
- helpers de reset da DB (`test/integration/_helpers/prisma-reset.ts`)

Quando tiveres os paths exatos, adiciono a secção com a lista de suites e o objetivo de cada uma.

---
