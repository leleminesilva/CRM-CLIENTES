-- CreateEnum
CREATE TYPE "WhatsAppProvider" AS ENUM ('EVOLUTION', 'META', 'WPPCONNECT', 'GREEN_API', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WhatsAppSessaoStatus" AS ENUM ('ONLINE', 'OFFLINE', 'RECONNECTING', 'WAITING_QR', 'ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WhatsAppSessaoEvento" AS ENUM ('CONECTOU', 'DESCONECTOU', 'QR_GERADO', 'QR_EXPIROU', 'ERRO', 'RECONECTOU', 'REINICIOU', 'ATUALIZOU');

-- CreateEnum
CREATE TYPE "WhatsAppMensagemStatus" AS ENUM ('ENVIANDO', 'ENVIADA', 'ENTREGUE', 'LIDA', 'FALHOU');

-- DropForeignKey
ALTER TABLE "whatsapp_conversas" DROP CONSTRAINT "whatsapp_conversas_instanciaId_fkey";

-- DropIndex
DROP INDEX "whatsapp_conversas_instanciaId_contatoPhone_key";

-- DropIndex
DROP INDEX "whatsapp_conversas_instanciaId_idx";

-- DropIndex
DROP INDEX "whatsapp_mensagens_waId_key";

-- AlterTable
ALTER TABLE "whatsapp_conversas" DROP COLUMN "instanciaId",
ADD COLUMN     "sessaoId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "whatsapp_mensagens" DROP COLUMN "waId",
ADD COLUMN     "entregueEm" TIMESTAMP(3),
ADD COLUMN     "falhouEm" TIMESTAMP(3),
ADD COLUMN     "lidaEm" TIMESTAMP(3),
ADD COLUMN     "providerMessageId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "WhatsAppMensagemStatus" NOT NULL DEFAULT 'ENVIANDO';

-- DropTable
DROP TABLE "whatsapp_instancias";

-- CreateTable
CREATE TABLE "whatsapp_sessoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "numero" TEXT,
    "provider" "WhatsAppProvider" NOT NULL DEFAULT 'EVOLUTION',
    "providerVersion" TEXT,
    "providerSessionId" TEXT NOT NULL,
    "status" "WhatsAppSessaoStatus" NOT NULL DEFAULT 'UNKNOWN',
    "ultimoPing" TIMESTAMP(3),
    "ultimaMensagemRecebida" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "atendenteId" TEXT,
    "empresaId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_sessao_logs" (
    "id" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "evento" "WhatsAppSessaoEvento" NOT NULL,
    "detalhe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_sessao_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_webhook_events" (
    "id" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessoes_providerSessionId_key" ON "whatsapp_sessoes"("providerSessionId");

-- CreateIndex
CREATE INDEX "whatsapp_sessoes_atendenteId_idx" ON "whatsapp_sessoes"("atendenteId");

-- CreateIndex
CREATE INDEX "whatsapp_sessao_logs_sessaoId_idx" ON "whatsapp_sessao_logs"("sessaoId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_webhook_events_providerEventId_key" ON "whatsapp_webhook_events"("providerEventId");

-- CreateIndex
CREATE INDEX "whatsapp_conversas_sessaoId_idx" ON "whatsapp_conversas"("sessaoId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversas_sessaoId_contatoPhone_key" ON "whatsapp_conversas"("sessaoId", "contatoPhone");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_mensagens_providerMessageId_key" ON "whatsapp_mensagens"("providerMessageId");

-- AddForeignKey
ALTER TABLE "whatsapp_sessoes" ADD CONSTRAINT "whatsapp_sessoes_atendenteId_fkey" FOREIGN KEY ("atendenteId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_sessao_logs" ADD CONSTRAINT "whatsapp_sessao_logs_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "whatsapp_sessoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_conversas" ADD CONSTRAINT "whatsapp_conversas_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "whatsapp_sessoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

