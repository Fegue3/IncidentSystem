# Services Module

> Módulo responsável por **consultar serviços** (entidade `Service`) através de endpoints REST, com filtros simples e pesquisa por texto.  
> Implementação: NestJS + Prisma.

---

## Estrutura de ficheiros

- `src/services/dto/list-services.dto.ts`
- `src/services/services.controller.ts`
- `src/services/services.service.ts`
- `src/services/services.module.ts`

---

## Responsabilidades

- Expor endpoints HTTP para:
  - **Listar serviços** com filtros opcionais.
  - **Obter serviço por `id`**.
  - **Obter serviço por `key`**.
- Centralizar a lógica de consulta à base de dados via `PrismaService`.
- Garantir validação básica de query params com `class-validator`.

---

## Dependências

### Prisma
- O módulo importa `PrismaModule`, que fornece `PrismaService`.
- As queries são feitas com:
  - `prisma.service.findMany`
  - `prisma.service.findUnique`

---

## DTOs

### `ListServicesDto` (`src/services/dto/list-services.dto.ts`)

DTO usado na rota `GET /services` para validar parâmetros de query.

**Campos:**
- `isActive?: string`
  - Validação: `@IsBooleanString()` (aceita `"true"` ou `"false"`)
  - Objetivo: filtrar serviços ativos/inativos
- `q?: string`
  - Validação: `@IsString()`
  - Objetivo: pesquisa por `key` ou `name` (case-insensitive)

**Exemplos:**
- `GET /services?isActive=true`
- `GET /services?q=auth`
- `GET /services?isActive=false&q=billing`

---

## Controller

### `ServicesController` (`src/services/services.controller.ts`)

Base route: **`/services`**

#### `GET /services`
Lista serviços com filtros opcionais.

**Query params:**
- `isActive` (`"true" | "false"`) — opcional
- `q` (string) — opcional

**Resposta (200):**
- Array de `Service` ordenado por `name` asc.

---

#### `GET /services/id/:id`
Obtém um serviço pelo `id`.

**Path param:**
- `id` (string)

**Respostas:**
- `200` — objeto `Service`
- `404` — `Service not found`

---

#### `GET /services/key/:key`
Obtém um serviço pela `key`.

**Path param:**
- `key` (string)

**Respostas:**
- `200` — objeto `Service`
- `404` — `Service not found`

---

## Service (Lógica de negócio)

### `ServicesService` (`src/services/services.service.ts`)

#### `list(dto: ListServicesDto)`
Retorna lista de serviços, aplicando:

1. **Pesquisa `q`**
   - Faz `contains` em `key` e `name`
   - Case-insensitive (`mode: 'insensitive'`)
   - Importante: mantém exatamente **duas condições** no `OR` (compatível com unit tests)

2. **Filtro `isActive`**
   - Aceita `string` `"true"/"false"` ou boolean
   - Converte para boolean:
     - `"true"` -> `true`
     - `"false"` -> `false`

3. **Ordenação**
   - `orderBy: { name: 'asc' }`

---

#### `findAll(dto: ListServicesDto)`
Alias de compatibilidade que chama `list(dto)`.

> Útil caso exista código legado a chamar `findAll()`.

---

#### `findByKey(key: string)`
Procura um serviço por `key`.

- Se não existir: lança `NotFoundException('Service not found')`.

---

#### `getByKey(key: string)`
Alias de `findByKey(key)`.

---

#### `findById(id: string)`
Procura um serviço por `id`.

- Se não existir: lança `NotFoundException('Service not found')`.

---

#### `getById(id: string)`
Alias de `findById(id)`.

---

## Módulo

### `ServicesModule` (`src/services/services.module.ts`)

- `imports: [PrismaModule]`
- `controllers: [ServicesController]`
- `providers: [ServicesService]`
- `exports: [ServicesService]` (permite reutilização noutros módulos)

---

## Exemplos rápidos (requests)

### Listar todos
`GET /services`

### Listar só ativos
`GET /services?isActive=true`

### Pesquisar por termo
`GET /services?q=auth`

### Pesquisar + filtrar
`GET /services?isActive=true&q=billing`

### Obter por id
`GET /services/id/clx123...`

### Obter por key
`GET /services/key/auth-api`

---

## Notas de qualidade / manutenção

- O DTO valida tipos básicos, mas **a conversão** de `isActive` para boolean é feita no service para suportar entradas “reais” vindas do querystring.
- Se quiseres paginação no futuro:
  - adicionar `page`, `pageSize` no DTO
  - usar `skip/take` no Prisma
- Se quiseres pesquisa mais avançada:
  - adicionar pesos/relevância (ex.: `orderBy` por matches) ou full-text search (dependendo do DB).

---
