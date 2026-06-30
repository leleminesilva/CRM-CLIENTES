-- AlterEnum
ALTER TYPE "TipoNotificacao" ADD VALUE 'ORCAMENTO_PENDENTE';

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "orcamentoEnviadoEm" TIMESTAMP(3);
