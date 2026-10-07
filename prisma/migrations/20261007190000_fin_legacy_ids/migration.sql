-- Guarda o id de origem (financeiro_*) nas cópias do Caixa antigo. Só altera tabelas fin_*.
-- AlterTable
ALTER TABLE "fin_accounts" ADD COLUMN     "legacy_id" TEXT;

-- AlterTable
ALTER TABLE "fin_categories" ADD COLUMN     "legacy_id" TEXT;

-- AlterTable
ALTER TABLE "fin_transactions" ADD COLUMN     "legacy_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "fin_accounts_workspace_id_legacy_id_key" ON "fin_accounts"("workspace_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_categories_workspace_id_legacy_id_key" ON "fin_categories"("workspace_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "fin_transactions_workspace_id_legacy_id_key" ON "fin_transactions"("workspace_id", "legacy_id");

