-- Foto de perfil do contato/grupo no WhatsApp (URL expira; re-sincronizada).
ALTER TABLE "whatsapp_conversas" ADD COLUMN "fotoUrl" TEXT;
ALTER TABLE "whatsapp_conversas" ADD COLUMN "fotoSyncEm" TIMESTAMP(3);
