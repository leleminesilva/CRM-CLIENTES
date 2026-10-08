-- Comissões passam a ser despesa paga ao vendedor: guarda quem recebe. Aditiva; linhas antigas ficam com vendedor vazio.
ALTER TABLE "fin_commissions" ADD COLUMN "seller_name" TEXT NOT NULL DEFAULT '';
