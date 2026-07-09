-- DropIndex
DROP INDEX "whatsapp_instancias_sessaoId_key";

-- AlterTable
ALTER TABLE "whatsapp_instancias" DROP COLUMN "qrCode",
DROP COLUMN "sessaoId",
DROP COLUMN "statusConexao",
DROP COLUMN "tipo",
DROP COLUMN "ultimoPing",
ALTER COLUMN "phoneNumberId" SET NOT NULL,
ALTER COLUMN "accessToken" SET NOT NULL;

-- DropEnum
DROP TYPE "WhatsAppTipoConexao";

