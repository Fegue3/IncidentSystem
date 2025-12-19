# App (Bootstrap) — Documentação do Módulo Base

Este conjunto de ficheiros constitui o “core” da aplicação NestJS: define o módulo raiz (`AppModule`), um endpoint base (`AppController`), um service mínimo (`AppService`) e o **bootstrap** do servidor (`main.ts`) com **Datadog tracing**, **CORS**, **prefixo global** e **validação**.

---

## Ficheiros cobertos

- `src/app.controller.ts`
- `src/app.service.ts`
- `src/app.module.ts`
- `src/main.ts`

---

## 1) `src/app.controller.ts`

### Responsabilidade única
Expor um endpoint base **GET /** que devolve uma string simples via `AppService`.

### Porque existe
- Smoke test rápido (confirma que a API responde).
- Útil para verificações simples em desenvolvimento/CI.
- Em produção, para health checks completos, o ideal é usar um **HealthModule** dedicado.

### Rotas
- `GET /` → `AppService.getHello()` → `"Hello World!"`

### Segurança / validações
- Sem autenticação.
- Sem validação (não recebe input).

### Testabilidade
- Unit test trivial: mock do `AppService` e assert do retorno.

---

## 2) `src/app.service.ts`

### Responsabilidade única
Fornecer a lógica mínima para a resposta do endpoint base.

### Porque existe
Mantém o controller magro e consistente com o padrão Nest:
> Controller → chama Service → retorna resultado.

### API
- `getHello(): string`

---

## 3) `src/app.module.ts`

### Responsabilidade única
Ser o **módulo raiz** (root module) do NestJS, agregando os módulos de domínio e expondo os providers/controllers de topo.

### Porque existe
- É a “raiz” do grafo de DI (Dependency Injection).
- Centraliza a composição da aplicação (imports/exports).

### Imports (dependências) e porquê
- `PrismaModule`: acesso a DB via Prisma (`PrismaService`).
- `HealthModule`: endpoints de health (ex.: `/health`), quando implementado.
- `AuthModule`: autenticação e guards (ex.: JWT).
- `UsersModule`: gestão de utilizadores.
- `IncidentsModule`: domínio de incidentes.
- `TeamsModule`: equipas e membros.
- `ServicesModule`: catálogo/gestão de serviços afetados.
- `NotificationsModule`: integrações (Discord/PagerDuty/...).
- `ReportsModule`: KPIs, breakdowns, exports CSV/PDF.

### Testabilidade
- Test de integração/DI: `Test.createTestingModule({ imports: [AppModule] })` para garantir que compõe sem erros.
- Se `PrismaModule` for global, reduz boilerplate de imports em módulos de domínio.

---

## 4) `src/main.ts`

### Responsabilidade única
**Bootstrapping** da aplicação:
1. Inicializa instrumentação Datadog (`dd-trace`) antes de carregar módulos do framework.
2. Cria a app Nest (`NestFactory.create(AppModule)`).
3. Aplica configurações cross‑cutting:
   - `setGlobalPrefix('api')`
   - `enableCors(...)`
   - `useGlobalPipes(new ValidationPipe({ whitelist: true }))`
4. Faz `listen()` na porta.

---

## Datadog tracing (`dd-trace`)

### Porque é feito no topo do ficheiro
O `tracer.init(...)` deve correr **antes** do Nest carregar módulos/handlers para permitir auto-instrumentação de libs/framework.

### Variáveis de ambiente suportadas
- `DD_TRACE_SAMPLE_RATE` (default `1`)
- `DD_SERVICE` (default `es-backend`)
- `DD_ENV` ou `NODE_ENV` (default `development`)
- `DD_VERSION` (opcional)

### Nota de robustez
- Se `DD_TRACE_SAMPLE_RATE` não for numérico, o código faz fallback para `1`.

---

## Prefixo global `/api`

### O que muda
Todas as rotas passam a ser prefixadas:
- `/auth/register` → **`/api/auth/register`**
- `/reports/kpis` → **`/api/reports/kpis`**

Isto é importante para o frontend e para documentação (Swagger/clients).

---

## CORS (Cross-Origin Resource Sharing)

### Configuração atual
Permite requests do frontend em:
- `origin: http://localhost:5173`

E inclui:
- `methods: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS` (inclui preflight)
- `allowedHeaders: Content-Type, Authorization`
- `credentials: true` (futuro uso de cookies/sessões)

### Erros típicos
Se o teu frontend estiver noutra porta (ex.: `http://localhost:5174`), vais ter erro de CORS, porque o `origin` não corresponde.

**Soluções comuns:**
- Ajustar a origin para a porta correta, ou
- Permitir uma lista de origins (array), ou
- Usar uma função `origin: (origin, cb) => ...` para validar dinamicamente (mais flexível em dev).

---

## Validação global (`ValidationPipe`)

### Configuração atual
- `whitelist: true` → remove propriedades extra (não declaradas no DTO).

### Opções recomendadas (dependendo do teu objetivo)
- `forbidNonWhitelisted: true` → em vez de remover, **rejeita** (400) quando chegam campos extra.
- `transform: true` → transforma tipos para DTOs (útil em query params como números/booleanos).

> No teu projeto, como usas DTOs para queries (`class-validator`), `transform: true` pode facilitar coerções (mas muda comportamento e pode afetar testes).

---

## Porta e execução

### Porta
- Usa `PORT` se definido, caso contrário `3000`.

### Comportamento final esperado
- API a ouvir em `http://localhost:3000`
- Rotas reais começam por `http://localhost:3000/api/...`

---

## Checklist de qualidade

- [ ] `dd-trace` inicializa antes do Nest (OK)
- [ ] `setGlobalPrefix('api')` consistente com o frontend e testes (OK)
- [ ] `enableCors` alinhado com a origem real do frontend (verificar)
- [ ] DTOs com `ValidationPipe` e whitelist (OK)
- [ ] `PORT` configurável em runtime (OK)

---

## Exemplos rápidos

### Chamada ao endpoint base
- `GET http://localhost:3000/api/` → `"Hello World!"` (se o prefixo `/api` se aplicar também ao controller raiz)

> Nota: como o `AppController` está em `@Controller()` (sem path), com `setGlobalPrefix('api')` a rota fica `GET /api`.

### Exemplo de CORS correto em dev
Frontend em `http://localhost:5173` → requests para `http://localhost:3000/api/...` devem passar sem preflight errors.

---
