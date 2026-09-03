-- Motor de automações do WhatsApp: regras gatilho -> ações.
CREATE TYPE "WhatsAppGatilho" AS ENUM ('CONTATO_NOVO', 'MENSAGEM_RECEBIDA', 'FORA_DO_HORARIO');

CREATE TABLE "whatsapp_automacoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "gatilho" "WhatsAppGatilho" NOT NULL,
    "gatilhoConfig" JSONB,
    "acoes" JSONB NOT NULL,
    "sessaoId" TEXT,
    "disparos" INTEGER NOT NULL DEFAULT 0,
    "ultimoDisparoEm" TIMESTAMP(3),
    "criadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_automacoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_automacoes_ativa_idx" ON "whatsapp_automacoes"("ativa");
