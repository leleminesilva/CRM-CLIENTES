-- AlterEnum
ALTER TYPE "OrigemCliente" ADD VALUE 'WHATSAPP';

-- CreateEnum
CREATE TYPE "BotEstado" AS ENUM ('TRIAGEM', 'COLETANDO', 'AGUARDANDO_CONFIRMACAO', 'CONCLUIDO', 'HUMANO');

-- CreateEnum
CREATE TYPE "HandoffReason" AS ENUM ('MUITAS_TENTATIVAS', 'CLIENTE_PEDIU_HUMANO', 'SERVICO_NAO_RECONHECIDO');

-- CreateTable
CREATE TABLE "whatsapp_agent_estados" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "estado" "BotEstado" NOT NULL DEFAULT 'TRIAGEM',
    "nome" TEXT,
    "servico" TEXT,
    "cidade" TEXT,
    "urgente" BOOLEAN NOT NULL DEFAULT false,
    "resumo" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "motivoTransferencia" "HandoffReason",
    "agentVersion" TEXT NOT NULL DEFAULT '1.0',
    "clienteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_agent_estados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_agent_estados_conversaId_key" ON "whatsapp_agent_estados"("conversaId");

-- AddForeignKey
ALTER TABLE "whatsapp_agent_estados" ADD CONSTRAINT "whatsapp_agent_estados_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "whatsapp_conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
