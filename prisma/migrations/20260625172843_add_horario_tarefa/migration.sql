-- CreateEnum
CREATE TYPE "StatusOrcamentoCliente" AS ENUM ('PENDENTE', 'APROVADO', 'NAO_APROVADO');

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "dataInscricao" TIMESTAMP(3),
ADD COLUMN     "numeroOrcamento" TEXT,
ADD COLUMN     "prazoOrcamento" TIMESTAMP(3),
ADD COLUMN     "servicoBuscado" TEXT,
ADD COLUMN     "statusOrcamento" "StatusOrcamentoCliente" NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN     "temperatura" "Temperatura" NOT NULL DEFAULT 'MORNO',
ADD COLUMN     "tipoResidencia" TEXT,
ADD COLUMN     "valorOrcamento" DECIMAL(15,2);

-- AlterTable
ALTER TABLE "tarefas" ADD COLUMN     "horario" TEXT;
