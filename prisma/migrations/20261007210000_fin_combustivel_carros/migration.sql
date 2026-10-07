-- Liga a despesa de gasolina (fin_transactions) ao uso de carro. Só altera fin_transactions:
-- financeiro_carro_usos não muda (a FK fica do lado do Financeiro novo).
-- AlterTable
ALTER TABLE "fin_transactions" ADD COLUMN     "car_use_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "fin_transactions_car_use_id_key" ON "fin_transactions"("car_use_id");

-- AddForeignKey
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_car_use_id_fkey" FOREIGN KEY ("car_use_id") REFERENCES "financeiro_carro_usos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

