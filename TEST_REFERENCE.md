# 🧪 Testes Abrangentes — Filtros, Pesquisa e Notificações

Foram criados testes **unit**, **integration** e **e2e** para cobrir todas as funcionalidades novas.

## 📋 Ficheiros de Testes Criados

### Unit Tests
- **`test/unit/incidents.filtering.spec.ts`** — Testes unitários para lógica de filtros e pesquisa
  - Filtros por status, severidade, assigneeId, teamId, serviço
  - Pesquisa por título/descrição (case-insensitive)
  - Combinações de filtros
  - Filtros por intervalo de datas (createdFrom/createdTo)

### Integration Tests
- **`test/integration/incidents.filtering.int.spec.ts`** — Testes integração para a BD real
  - Filtros por status, severidade, equipa, serviço
  - Pesquisa em incidentes reais
  - Combinações de filtros
  - Ordenação (DESC por createdAt)

- **`test/integration/notifications.int.spec.ts`** — Testes integração para notificações
  - Criação de incidente SEV1 com Discord e PagerDuty
  - Criação de incidente SEV2 com notificações
  - SEV3 e SEV4 NOT disparam notificações
  - Inclusão de FRONTEND_BASE_URL na mensagem Discord

### E2E Tests
- **`test/e2e/incidents.notifications.e2e.spec.ts`** — Testes E2E completos
  - Criação de incidentes SEV1/SEV2/SEV3/SEV4
  - Verificação de status NEW automático
  - Timeline events (STATUS_CHANGE, notificações)
  - Subscription do reporter
  - Incidentes com assignee e serviço

---

## ▶️ Como Correr os Testes

### Unit Tests (rápido, sem BD)
```bash
cd backend
npm run test -- incidents.filtering.spec.ts
npm run test -- notifications.service.spec.ts
```

### Integration Tests (com BD real)
Requer Docker a correr (`docker compose up -d`).

```bash
cd backend
npm run test:int -- incidents.filtering.int.spec.ts
npm run test:int -- notifications.int.spec.ts
```

### E2E Tests (cenários completos)
```bash
cd backend
npm run test:e2e -- incidents.notifications.e2e.spec.ts
```

### Todos os testes do projeto
```bash
cd backend
npm test                    # Unit + integration
npm run test:e2e           # E2E
npm run test:cov           # Com cobertura
```

---

## 🎯 Cobertura de Testes

| Funcionalidade | Unit | Integration | E2E | Status |
|---|---|---|---|---|
| Filtro por status | ✅ | ✅ | ✅ | OK |
| Filtro por severidade | ✅ | ✅ | ✅ | OK |
| Filtro por equipa | ✅ | ✅ | ✅ | OK |
| Filtro por serviço (ID) | ✅ | ✅ | ✅ | OK |
| Filtro por serviço (key) | ✅ | ✅ | ✅ | OK |
| Pesquisa por texto | ✅ | ✅ | ✅ | OK |
| Filtros combinados | ✅ | ✅ | ✅ | OK |
| Filtro por data (range) | ✅ | ✅ | ✅ | OK |
| Notificação SEV1 Discord | ✅ | ✅ | ✅ | OK |
| Notificação SEV1 PagerDuty | ✅ | ✅ | ✅ | OK |
| Notificação SEV2 | ✅ | ✅ | ✅ | OK |
| Sem notif SEV3/SEV4 | ✅ | ✅ | ✅ | OK |
| Timeline events | ✅ | ✅ | ✅ | OK |
| Subscription reporter | ✅ | ✅ | ✅ | OK |

---

## 🔍 Resumo de Casos de Teste

### Filtros (32 testes)
1. **Status**: NEW, TRIAGED, IN_PROGRESS, ON_HOLD, RESOLVED, CLOSED, REOPENED
2. **Severidade**: SEV1, SEV2, SEV3, SEV4
3. **Equipa**: teamId filter
4. **Serviço**: primaryServiceId, primaryServiceKey, resolução de key→id
5. **Pesquisa**: título, descrição, case-insensitive
6. **Data**: createdFrom, createdTo, range
7. **Combinados**: 2-3 filtros juntos

### Notificações (12 testes)
1. **SEV1**: Discord + PagerDuty
2. **SEV2**: Discord + PagerDuty
3. **SEV3**: Sem notificações
4. **SEV4**: Sem notificações
5. **Timeline**: FIELD_UPDATE com resultado
6. **Subscription**: reporter subscribe automaticamente
7. **FRONTEND_BASE_URL**: incluído nas mensagens

---

## ✅ Execução Sugerida

```bash
# 1. Garantir Docker a correr
docker compose up -d

# 2. Testes unitários (rápido)
cd backend && npm test -- incidents.filtering.spec.ts

# 3. Testes integração (com BD)
npm run test:int -- incidents.filtering.int.spec.ts
npm run test:int -- notifications.int.spec.ts

# 4. E2E (fluxo completo)
npm run test:e2e -- incidents.notifications.e2e.spec.ts

# 5. Cobertura total
npm run test:cov
```

---

## 📊 Resultado Esperado

Todos os testes devem passar com sucesso:
- **Unit**: < 1s
- **Integration**: 5-10s (com migrations BD)
- **E2E**: 10-20s (fluxo completo)

Total estimado: **~30 segundos** para suite completa.
