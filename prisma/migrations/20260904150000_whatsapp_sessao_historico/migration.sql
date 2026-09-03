-- Marca quando a importação do histórico da sessão terminou.
ALTER TABLE "whatsapp_sessoes" ADD COLUMN "historicoImportadoEm" TIMESTAMP(3);
