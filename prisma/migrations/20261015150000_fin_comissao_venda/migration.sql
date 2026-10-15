-- Comissão automática: liga a comissão à venda do CRM que a gerou. Aditiva.
ALTER TABLE "fin_commissions" ADD COLUMN "venda_id" TEXT;
CREATE UNIQUE INDEX "fin_commissions_venda_id_key" ON "fin_commissions"("venda_id");
