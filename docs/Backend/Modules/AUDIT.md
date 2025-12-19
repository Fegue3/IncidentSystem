# AUDIT — Integridade e Evidência de Incidentes (HMAC + Serialização Determinística)

Este documento descreve o mecanismo de auditoria do IMS que garante a **integridade** do estado de um incidente ao longo do tempo, através de:
- construção de um *payload canónico* (determinístico)
- serialização estável (ordem consistente)
- cálculo de um hash HMAC-SHA256 com um segredo (server-side)
- persistência do hash no registo do incidente (`auditHash`, `auditHashUpdatedAt`)

---

## 1) Objetivo e motivação

O objetivo do módulo de audit é permitir:
- **detetar alterações não autorizadas** ou inconsistências no histórico de um incidente
- fornecer um artefacto de evidência (“este estado existiu e não foi adulterado”)
- suportar requisitos de compliance (ex.: incidentes com PII, segurança, auditorias internas)

Em termos práticos: o sistema guarda um `auditHash` calculado a partir de um snapshot canónico do incidente e das suas relações relevantes (timeline, comments, tags, categories, CAPA, sources). Se qualquer um destes elementos mudar, o hash muda.

---

## 2) Onde se aplica no modelo de dados

No schema Prisma (Incident):
- `auditHash: String?`
- `auditHashUpdatedAt: DateTime?`

O audit é guardado no próprio incidente para:
- permitir verificação rápida
- evitar recomputações em leitura simples
- facilitar exportações/relatórios que precisam de “integridade confirmada”

---

## 3) Conceito base: “payload canónico” + HMAC

### 3.1 Payload canónico
O módulo constrói um objeto com:
- campos “core” do incidente (id, title, status, severity, reporterId, etc.)
- relações relevantes normalizadas e ordenadas:
  - categories (CategoryOnIncident + category name/id)
  - tags
  - timeline events
  - comments
  - capas
  - sources

A ordem e o formato são estabilizados para que:
- o mesmo estado produza **sempre** o mesmo texto final
- diferenças de ordem de arrays/keys não causem hashes diferentes

### 3.2 Serialização estável
A função `stableStringify` faz uma serialização JSON-like determinística:
- ordena chaves de objetos alfabeticamente
- preserva ordem de arrays
- normaliza Date → ISO string
- BigInt → string
- deteta ciclos e falha (não permite hash de estruturas “inconsistentes”)

### 3.3 Hash HMAC-SHA256
O hash é calculado com HMAC usando um segredo:
- algoritmo: SHA-256
- saída: hex string

Isto garante:
- integridade (alterações mudam o hash)
- autenticidade do hash (sem o segredo não dá para “forjar” um hash válido)

---

## 4) O que entra (e o que não entra) no audit payload

### 4.1 Campos do incidente incluídos
Inclui:
- `id`
- `title`, `description`
- `status`, `severity`
- `reporterId`, `assigneeId`, `teamId`, `primaryServiceId`
- timestamps de métricas: `triagedAt`, `inProgressAt`, `resolvedAt`, `closedAt`
- `createdAt`

### 4.2 Campos explicitamente excluídos
Não inclui:
- `updatedAt`

Razão:
- `updatedAt` é alterado automaticamente por Prisma quando se escreve `auditHash` e `auditHashUpdatedAt`.
- Se `updatedAt` fosse incluído, o ato de guardar o hash causaria um mismatch imediato.

Esta exclusão é crucial para evitar “audit inválido” sem alterações de negócio.

---

## 5) Normalização e ordenação (determinismo)

Para evitar falsos positivos:
- `iso()` converte Date/valores compatíveis para ISO string ou `null`
- `sortKey()` converte valores para string ordenável (null-safe)

Ordenações aplicadas:
- Categories: por `categoryId`
- Tags: por `label`
- Timeline: por `createdAt` e depois por `id`
- Comments: por `createdAt` e depois por `id`
- CAPA: por `createdAt` e depois por `id`
- Sources: por `integrationId` e depois por `externalId`

Isto significa que, mesmo que o Prisma devolva relações numa ordem diferente, o payload final é consistente.

---

## 6) Funções principais do módulo

### 6.1 `stableStringify(value)`
Responsável por serialização determinística do payload.

Comportamento:
- primitivos → JSON.stringify
- Date → ISO
- BigInt → string JSON
- objetos → chaves ordenadas
- arrays → ordem preservada
- estruturas cíclicas → erro

### 6.2 `computeHmacSha256Hex(secret, payload)`
Gera o hash HMAC-SHA256 em hexadecimal.

Requisitos:
- `secret` obrigatório
- `payload` obrigatório

Falha (throw) se secret/payload não forem fornecidos.

### 6.3 `buildIncidentAuditPayload(incident)`
Constrói o objeto canónico a partir de um incidente já carregado com includes.

Produz:
- `{ incident: {...}, categories: [...], tags: [...], timeline: [...], comments: [...], capas: [...], sources: [...] }`

### 6.4 `computeIncidentAuditHash(prisma, incidentId, secret)`
Fluxo:
1) carrega incidente via Prisma com `include` das relações relevantes
2) valida existência
3) constrói payload (`buildIncidentAuditPayload`)
4) serializa (`stableStringify`)
5) calcula hash (`computeHmacSha256Hex`)
6) devolve `{ hash, canonical, payloadObj }`

Notas:
- A query inclui selects mínimos e ordenações onde relevante (`orderBy createdAt asc`) para reduzir variabilidade.

### 6.5 `ensureIncidentAuditHash(prisma, incidentId, secret?)`
Função de conveniência usada no fluxo de escrita:
- se `secret` não existir → retorna `null` (audit desativado)
- caso contrário:
  1) calcula hash
  2) atualiza o incidente com `auditHash` e `auditHashUpdatedAt = now()`
  3) devolve o hash

---

## 7) Dependências e integração no backend

### Dependências técnicas
- Node `crypto` (`createHmac`)
- Prisma (via uma interface `PrismaLike` minimalista)

O uso de `PrismaLike` é intencional:
- facilita testes unitários (mock do prisma)
- evita dependência forte de uma instância concreta

### Integração típica
O audit deve ser chamado em pontos onde o estado do incidente muda, por exemplo:
- criação de incidentes
- mudança de status
- alteração de assignee/team/service/severity
- adição de comment
- adição de timeline events
- criação/atualização de CAPA
- ligação de sources externas

A implementação concreta (“onde chamar”) deve existir nos services (ex.: `incidents.service.ts`, `reports.service.ts` se precisar de garantir integridade antes de export).

---

## 8) Segurança operacional

### Gestão do segredo (secret)
- O segredo deve vir de environment/config do servidor (ex.: `AUDIT_HMAC_SECRET`).
- Não deve ser exposto a clientes nem guardado na DB.
- Rotação de segredo implica que hashes antigos deixam de validar se forem recomputados com um segredo novo.
  - Se quiserem rotação, convém versionar segredos ou guardar “key id”.

### Resistência a adulteração
- Sem o segredo, um atacante não consegue gerar um hash válido para um payload adulterado.
- O hash prova integridade desde que o segredo seja protegido.

---

## 9) Limitações e decisões de design

- O audit é um snapshot lógico, não um log imutável independente.
- Se o conteúdo histórico (timeline/comments) for editável, o audit vai mudar.
  - Isto é desejável se a edição é “mudança real”.
  - Se vocês quiserem “imutabilidade”, o correto é bloquear updates em comments/events e só permitir append.

- O audit inclui bastante informação. Recomputar em massa pode ser caro.
  - Por isso existe `auditHashUpdatedAt` para rastrear quando foi atualizado.

---

## 10) Recomendações de testes

Testes unitários sugeridos:
- `stableStringify` produz o mesmo output para objetos com keys em ordem diferente
- arrays preservam ordem
- Date → ISO
- cycle detection lança erro
- `buildIncidentAuditPayload` ordena consistentemente (tags/categories/timeline/etc.)
- `ensureIncidentAuditHash` não atualiza quando secret é undefined
- `updatedAt` não é incluído (evita loop)

Testes de integração sugeridos:
- após criar/atualizar incidente, `auditHash` é preenchido quando secret existe
- alterar comment/timeline muda o hash
- apenas atualizar `auditHash` não cria mismatch (garantido pela exclusão de updatedAt)

---
