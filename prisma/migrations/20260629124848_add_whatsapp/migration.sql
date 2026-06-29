-- CreateTable
CREATE TABLE "whatsapp_instancias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_instancias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_conversas" (
    "id" TEXT NOT NULL,
    "instanciaId" TEXT NOT NULL,
    "contatoPhone" TEXT NOT NULL,
    "contatoNome" TEXT,
    "clienteId" TEXT,
    "ultimaMsgEm" TIMESTAMP(3),
    "naoLidas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_mensagens" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "waId" TEXT,
    "direcao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'texto',
    "conteudo" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enviada',
    "enviadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_instancias_phoneNumberId_key" ON "whatsapp_instancias"("phoneNumberId");

-- CreateIndex
CREATE INDEX "whatsapp_conversas_instanciaId_idx" ON "whatsapp_conversas"("instanciaId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_conversas_instanciaId_contatoPhone_key" ON "whatsapp_conversas"("instanciaId", "contatoPhone");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_mensagens_waId_key" ON "whatsapp_mensagens"("waId");

-- CreateIndex
CREATE INDEX "whatsapp_mensagens_conversaId_idx" ON "whatsapp_mensagens"("conversaId");

-- AddForeignKey
ALTER TABLE "whatsapp_conversas" ADD CONSTRAINT "whatsapp_conversas_instanciaId_fkey" FOREIGN KEY ("instanciaId") REFERENCES "whatsapp_instancias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_mensagens" ADD CONSTRAINT "whatsapp_mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "whatsapp_conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
