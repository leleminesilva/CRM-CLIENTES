-- AlterEnum
ALTER TYPE "EstagioLead" ADD VALUE 'REENGAJAR';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "proximoContato" TIMESTAMP(3);
