-- CreateEnum
CREATE TYPE "StatusPosVenda" AS ENUM ('AGUARDANDO_VIDRO', 'VIDRO_CHEGOU', 'AGENDADO', 'CONCLUIDO');

-- AlterTable
ALTER TABLE "vendas" ADD COLUMN     "statusPosVenda" "StatusPosVenda" NOT NULL DEFAULT 'AGUARDANDO_VIDRO',
ADD COLUMN     "ordemKanban" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vidroChegouEm" TIMESTAMP(3),
ADD COLUMN     "dataAgendamento" TIMESTAMP(3),
ADD COLUMN     "horarioAgendamento" TEXT,
ADD COLUMN     "observacoesPosVenda" TEXT;
