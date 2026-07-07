-- Backfill orcamentoEnviadoEm para clientes que têm valorOrcamento mas não têm data
-- Usa createdAt como data do orçamento para manter consistência histórica
UPDATE "clientes"
SET "orcamentoEnviadoEm" = "createdAt"
WHERE "valorOrcamento" IS NOT NULL
  AND "orcamentoEnviadoEm" IS NULL
  AND "deletedAt" IS NULL;
