-- AlterTable
ALTER TABLE "whatsapp_conversas" ADD COLUMN     "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
