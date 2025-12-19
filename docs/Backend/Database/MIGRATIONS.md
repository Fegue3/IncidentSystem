# Prisma Migrations — Histórico e Operação (Backend)

Este documento descreve **como o projeto gere migrações Prisma** e dá uma visão “auditável” do que cada migração representa **com base no nome da pasta** (sem assumir o SQL interno).  
Pasta: `backend/prisma/migrations/`

> Nota: Para detalhes 100% exatos (SQL, diffs, ordem de alterações), consulta o conteúdo de cada pasta em `migrations/<timestamp>_<name>/`.

---

## Estrutura da pasta `migrations/`

Cada migração gerada pelo Prisma cria uma pasta com:
- `migration.sql` — SQL aplicado na BD quando corres `prisma migrate dev/deploy`.
- (Opcional) metadata interna do Prisma.

Além disso, existe:
- `migration_lock.toml` — lock do provider (ex.: postgres), para consistência do sistema de migrações.

---

## Como aplicar migrações (dev vs prod)

### Desenvolvimento (criar + aplicar)
```bash
cd backend
npx prisma migrate dev
```

Para criar uma migração com nome explícito:
```bash
npx prisma migrate dev --name <nome_legivel>
```

### Produção/CI (aplicar migrações já commitadas)
```bash
cd backend
npx prisma migrate deploy
```

### Reset total (apenas dev!)
```bash
cd backend
npx prisma migrate reset
```
⚠️ Apaga dados da BD e reaplica migrações + seed (se configurado).

---

## Ordem e convenções

- As migrações são ordenadas por **timestamp** no nome da pasta.
- Regra prática: **cada mudança ao `schema.prisma` deve virar migração** (evita drift entre ambientes).
- Evita editar `migration.sql` manualmente, exceto casos raros e controlados (e sempre com revisão).

---

## Lista de migrações do projeto

Abaixo está a lista conforme o snapshot fornecido. A descrição é **inferida pelo nome**:

| Pasta | Intenção provável | Impacto típico |
|------|-------------------|----------------|
| `20251025211341_fix_relations` | Ajustes/correções em relações (FKs, relations Prisma, onDelete/onUpdate) | Pode alterar constraints e colunas FK |
| `20251120224655_simplify_roles` | Simplificação do modelo de roles (ex.: reduzir enum, alinhar com RBAC USER/ADMIN) | Pode alterar enum Role, defaults e lógica associada |
| `20251207022650_rename_priority_to_severity` | Rename de “priority” para “severity” | Renomeio de coluna/enum e adaptação de queries/DTOs |
| `20251212115927_add_service` | Introdução/expansão do modelo `Service` | Novas tabelas/colunas e relations (Incident → Service) |
| `20251215102838_add_audit_hash` | Adição de campos/infra de `auditHash` no `Incident` | Novas colunas, índices e base para integridade/auditoria |
| `20251217155158_integrations_settings` | Adição de `IntegrationSetting` (preferências por user/kind) | Nova tabela e unique constraints (userId, kind) |
| `20251217163659_integration_discord` | Ajustes específicos para integração Discord | Pode adicionar enum value, settings, campos ou triggers de fluxo |

> Dica: se quiseres que isto fique “perfeito”, adiciona em cada pasta uma pequena nota `README.md` opcional (não gerada pelo Prisma) com:
> - “Motivação”
> - “Alteração principal”
> - “Risco/rollback manual”
> - “Impacto nos seeds/tests”

---

## Boas práticas recomendadas (para ficar profissional)

### 1) Sempre versionar migrações
- Commit de `schema.prisma` **+** `migrations/*` juntos.
- Evita “mudar schema e esquecer migração”.

### 2) Revisão de migrações em PR
Checklist:
- [ ] Migração cria índices onde há filtros frequentes (ex.: `Incident.createdAt`, `teamId`, `status`, etc.).
- [ ] Renames feitos com `@@map`/`@map` quando necessário para compatibilidade.
- [ ] Constraints coerentes (unique, FK, NOT NULL).
- [ ] `prisma generate` e testes a passar no CI.

### 3) Atenção a enums
Alterar enums em Postgres pode exigir passos específicos (dependendo do SQL gerado).  
Recomenda-se:
- Evitar renames de enum values em produção sem plano.
- Preferir adicionar novos valores e migrar dados antes de remover.

### 4) Seeds e migrações devem andar alinhados
Sempre que uma migração:
- adiciona campos obrigatórios,
- muda constraints,
- altera relations,
então os seeds (`seed.ts`, `seed.incidents.ts`, etc.) podem precisar de ajuste.

---

## Troubleshooting rápido

### “Drift detected” / schema não bate com BD
- Em dev: `npx prisma migrate reset`
- Em ambiente com dados: validar se alguém alterou a BD manualmente.

### “P3009 / migration failed”
- Ver logs do SQL no erro.
- Confirmar se a migração foi parcialmente aplicada.
- Em prod, não uses `reset`. Segue processo de correção com migração “hotfix”.

### “Cannot drop/rename because dependent objects exist”
- Pode ser rename de coluna/constraint; às vezes precisa de migração incremental (2 passos).


## Anexos

- Prisma schema: `backend/prisma/schema.prisma`
- Migrações: `backend/prisma/migrations/*`
- Seeds: `backend/prisma/seed*.ts`
