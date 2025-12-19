# IntegrationsPage (pages/Integrations/IntegrationsPage.tsx)

**Rota:** `/integrations`

## Responsabilidade única
Página informativa de integrações (Datadog/PagerDuty/Discord) nesta versão (sempre ativas).

## UI/UX
- Lista de cards com nome/descrição e link para docs externas.
- Toggle UI desativado (checked + disabled) para comunicar “sempre ativo”.

## Estado local (principais)
- `integrations` memoizado (config estática).

## APIs consumidas
- —

## Dependências
- React hook `useMemo`.
- CSS: `IntegrationsPage.css`.

## Regras/validações
- Config é estática (sem chamadas ao backend).

## Erros e estados vazios
- —

## Segurança e permissões
- Links externos usam `target=_blank` + `rel=noreferrer`.

## Performance
- —

## Testabilidade
- —

## Notas
- —
