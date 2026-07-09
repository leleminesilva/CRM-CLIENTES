-- CreateEnum
CREATE TYPE "WhatsAppTipoConexao" AS ENUM ('OFICIAL', 'QRCODE');

-- AlterTable
ALTER TABLE "whatsapp_instancias" ADD COLUMN     "qrCode" TEXT,
ADD COLUMN     "sessaoId" TEXT,
ADD COLUMN     "statusConexao" TEXT NOT NULL DEFAULT 'desconectado',
ADD COLUMN     "tipo" "WhatsAppTipoConexao" NOT NULL DEFAULT 'OFICIAL',
ALTER COLUMN "phoneNumberId" DROP NOT NULL,
ALTER COLUMN "accessToken" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_instancias_sessaoId_key" ON "whatsapp_instancias"("sessaoId");

