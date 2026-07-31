-- CreateTable
CREATE TABLE "vendas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "leadId" TEXT,
    "responsavelId" TEXT,
    "numeroOrcamento" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendas_leadId_key" ON "vendas"("leadId");

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: 1 Venda para cada Lead já fechado-ganho antes desta tabela existir,
-- senão o histórico de faturamento dos relatórios zeraria quando a query
-- passar a somar "vendas" em vez de "leads".
INSERT INTO "vendas" ("id", "clienteId", "leadId", "responsavelId", "numeroOrcamento", "valor", "data", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  l."clienteId",
  l."id",
  l."responsavelId",
  COALESCE(c."numeroOrcamento", ''),
  COALESCE(c."valorOrcamento", l."valorEstimado", 0),
  l."dataFechamento",
  now(),
  now()
FROM "leads" l
JOIN "clientes" c ON c."id" = l."clienteId"
WHERE l."estagio" = 'FECHADO_GANHO'
  AND l."deletedAt" IS NULL
  AND l."clienteId" IS NOT NULL
  AND l."dataFechamento" IS NOT NULL;
