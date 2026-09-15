-- CreateTable
CREATE TABLE "financeiro_carros" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "placa" TEXT NOT NULL,
    "cor" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financeiro_carros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financeiro_motoristas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financeiro_motoristas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financeiro_carro_usos" (
    "id" TEXT NOT NULL,
    "carroId" TEXT NOT NULL,
    "motoristaId" TEXT NOT NULL,
    "kmSaida" INTEGER NOT NULL,
    "saidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kmChegada" INTEGER,
    "chegadaEm" TIMESTAMP(3),
    "observacoes" TEXT,
    "registradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financeiro_carro_usos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financeiro_carros_placa_key" ON "financeiro_carros"("placa");

-- CreateIndex
CREATE INDEX "financeiro_carro_usos_carroId_saidaEm_idx" ON "financeiro_carro_usos"("carroId", "saidaEm");

-- CreateIndex
CREATE INDEX "financeiro_carro_usos_motoristaId_idx" ON "financeiro_carro_usos"("motoristaId");

-- AddForeignKey
ALTER TABLE "financeiro_carro_usos" ADD CONSTRAINT "financeiro_carro_usos_carroId_fkey" FOREIGN KEY ("carroId") REFERENCES "financeiro_carros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financeiro_carro_usos" ADD CONSTRAINT "financeiro_carro_usos_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "financeiro_motoristas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financeiro_carro_usos" ADD CONSTRAINT "financeiro_carro_usos_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
