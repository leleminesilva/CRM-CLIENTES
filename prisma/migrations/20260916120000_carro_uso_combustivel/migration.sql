-- AlterTable
ALTER TABLE "financeiro_carro_usos" ADD COLUMN     "valorCombustivel" DECIMAL(10,2),
ADD COLUMN     "lancamentoCombustivelId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "financeiro_carro_usos_lancamentoCombustivelId_key" ON "financeiro_carro_usos"("lancamentoCombustivelId");

-- AddForeignKey
ALTER TABLE "financeiro_carro_usos" ADD CONSTRAINT "financeiro_carro_usos_lancamentoCombustivelId_fkey" FOREIGN KEY ("lancamentoCombustivelId") REFERENCES "financeiro_lancamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: categoria "Combustível" (saída), pra já dar pra classificar o lançamento
-- automático gerado ao registrar o valor de gasolina entregue ao motorista.
INSERT INTO "financeiro_categorias" ("id", "nome", "tipo", "cor", "padrao", "createdAt")
VALUES ('fin_cat_combustivel', 'Combustível', 'SAIDA', '#0ea5e9', true, CURRENT_TIMESTAMP)
ON CONFLICT ("nome", "tipo") DO NOTHING;
