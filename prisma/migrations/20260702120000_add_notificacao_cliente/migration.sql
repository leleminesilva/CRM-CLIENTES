-- AlterTable
ALTER TABLE "clientes" ADD COLUMN "notificacaoMensagem" TEXT,
                        ADD COLUMN "notificacaoEm" TIMESTAMP(3),
                        ADD COLUMN "notificacaoLida" BOOLEAN NOT NULL DEFAULT false;
