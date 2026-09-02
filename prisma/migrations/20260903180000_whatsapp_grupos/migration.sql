-- Suporte a grupos de WhatsApp: marca a conversa como grupo e guarda quem
-- enviou cada mensagem dentro do grupo.
ALTER TABLE "whatsapp_conversas" ADD COLUMN "isGrupo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "whatsapp_mensagens" ADD COLUMN "remetenteNome" TEXT;
ALTER TABLE "whatsapp_mensagens" ADD COLUMN "remetentePhone" TEXT;
