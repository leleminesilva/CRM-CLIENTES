-- CreateEnum
CREATE TYPE "WhatsAppConversaStatus" AS ENUM ('ABERTA', 'PENDENTE', 'RESOLVIDA');

-- CreateEnum
CREATE TYPE "WhatsAppConversaEtapa" AS ENUM ('NOVA', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'ORCAMENTO_ENVIADO', 'FECHADO', 'SEM_RETORNO');

-- AlterTable
ALTER TABLE "whatsapp_conversas" ADD COLUMN     "status" "WhatsAppConversaStatus" NOT NULL DEFAULT 'ABERTA',
ADD COLUMN     "etapa" "WhatsAppConversaEtapa" NOT NULL DEFAULT 'NOVA',
ADD COLUMN     "responsavelId" TEXT;

-- CreateIndex
CREATE INDEX "whatsapp_conversas_responsavelId_idx" ON "whatsapp_conversas"("responsavelId");

-- AddForeignKey
ALTER TABLE "whatsapp_conversas" ADD CONSTRAINT "whatsapp_conversas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
