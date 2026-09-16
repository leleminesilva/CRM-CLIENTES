-- AlterTable
ALTER TABLE "whatsapp_etapas" ADD COLUMN     "visivelPara" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
