ALTER TABLE "clientes"
  ADD COLUMN "orcamentoFinalNumero" TEXT,
  ADD COLUMN "orcamentoFinalValor"  DECIMAL(15,2),
  ADD COLUMN "orcamentoFinalEm"     TIMESTAMP(3);
