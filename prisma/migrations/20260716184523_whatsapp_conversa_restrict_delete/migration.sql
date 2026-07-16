-- DropForeignKey
ALTER TABLE "whatsapp_conversas" DROP CONSTRAINT "whatsapp_conversas_sessaoId_fkey";

-- AddForeignKey
ALTER TABLE "whatsapp_conversas" ADD CONSTRAINT "whatsapp_conversas_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "whatsapp_sessoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

