-- CreateTable
CREATE TABLE "chat_mensagens" (
    "id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "destinatarioId" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_leituras" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ultimaGeral" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_leituras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_mensagens_destinatarioId_idx" ON "chat_mensagens"("destinatarioId");

-- CreateIndex
CREATE INDEX "chat_mensagens_autorId_idx" ON "chat_mensagens"("autorId");

-- CreateIndex
CREATE INDEX "chat_mensagens_createdAt_idx" ON "chat_mensagens"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_leituras_userId_key" ON "chat_leituras"("userId");

-- AddForeignKey
ALTER TABLE "chat_mensagens" ADD CONSTRAINT "chat_mensagens_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mensagens" ADD CONSTRAINT "chat_mensagens_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_leituras" ADD CONSTRAINT "chat_leituras_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

