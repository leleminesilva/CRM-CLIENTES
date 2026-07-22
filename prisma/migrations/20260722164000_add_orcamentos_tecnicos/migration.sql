-- CreateEnum
CREATE TYPE "ModoCalculoProduto" AS ENUM ('AREA', 'LINEAR', 'UNIDADE');

-- CreateEnum
CREATE TYPE "StatusOrcamentoTecnico" AS ENUM ('RASCUNHO', 'ENVIADO', 'APROVADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "StatusOrdemServico" AS ENUM ('EM_PRODUCAO', 'CONCLUIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "linhas_produto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linhas_produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos_catalogo" (
    "id" TEXT NOT NULL,
    "linhaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "modoCalculo" "ModoCalculoProduto" NOT NULL,
    "precoBase" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variantes_produto" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT,
    "precoUnitario" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variantes_produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamentos_tecnicos" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "clienteId" TEXT,
    "responsavelId" TEXT,
    "bairroInstalacao" TEXT,
    "enderecoInstalacao" TEXT,
    "observacoes" TEXT,
    "status" "StatusOrcamentoTecnico" NOT NULL DEFAULT 'RASCUNHO',
    "descontoPercentual" DECIMAL(5,2),
    "descontoValor" DECIMAL(15,2),
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "valorTotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orcamentos_tecnicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_orcamento_tecnico" (
    "id" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "varianteId" TEXT,
    "larguraMm" INTEGER,
    "alturaMm" INTEGER,
    "comprimentoMm" INTEGER,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "ambienteInstalacao" TEXT,
    "descricao" TEXT,
    "precoCalculado" DECIMAL(15,2) NOT NULL,
    "acrescimoValor" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalItem" DECIMAL(15,2) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itens_orcamento_tecnico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_servico" (
    "id" TEXT NOT NULL,
    "orcamentoId" TEXT NOT NULL,
    "vendedorId" TEXT,
    "previsaoEntrega" TIMESTAMP(3) NOT NULL,
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusOrdemServico" NOT NULL DEFAULT 'EM_PRODUCAO',
    "concluidoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ordens_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sobras_material" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT,
    "larguraMm" INTEGER,
    "alturaMm" INTEGER,
    "comprimentoMm" INTEGER,
    "origemOrcamentoId" TEXT,
    "disponivel" BOOLEAN NOT NULL DEFAULT true,
    "usadoEmItemId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sobras_material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "linhas_produto_nome_key" ON "linhas_produto"("nome");

-- CreateIndex
CREATE INDEX "produtos_catalogo_linhaId_idx" ON "produtos_catalogo"("linhaId");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_catalogo_linhaId_nome_key" ON "produtos_catalogo"("linhaId", "nome");

-- CreateIndex
CREATE INDEX "variantes_produto_produtoId_idx" ON "variantes_produto"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "variantes_produto_produtoId_nome_key" ON "variantes_produto"("produtoId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "orcamentos_tecnicos_numero_key" ON "orcamentos_tecnicos"("numero");

-- CreateIndex
CREATE INDEX "orcamentos_tecnicos_status_idx" ON "orcamentos_tecnicos"("status");

-- CreateIndex
CREATE INDEX "orcamentos_tecnicos_clienteId_idx" ON "orcamentos_tecnicos"("clienteId");

-- CreateIndex
CREATE INDEX "itens_orcamento_tecnico_orcamentoId_idx" ON "itens_orcamento_tecnico"("orcamentoId");

-- CreateIndex
CREATE INDEX "itens_orcamento_tecnico_produtoId_idx" ON "itens_orcamento_tecnico"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_servico_orcamentoId_key" ON "ordens_servico"("orcamentoId");

-- CreateIndex
CREATE INDEX "ordens_servico_status_idx" ON "ordens_servico"("status");

-- CreateIndex
CREATE INDEX "ordens_servico_previsaoEntrega_idx" ON "ordens_servico"("previsaoEntrega");

-- CreateIndex
CREATE INDEX "sobras_material_disponivel_idx" ON "sobras_material"("disponivel");

-- AddForeignKey
ALTER TABLE "produtos_catalogo" ADD CONSTRAINT "produtos_catalogo_linhaId_fkey" FOREIGN KEY ("linhaId") REFERENCES "linhas_produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variantes_produto" ADD CONSTRAINT "variantes_produto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos_tecnicos" ADD CONSTRAINT "orcamentos_tecnicos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos_tecnicos" ADD CONSTRAINT "orcamentos_tecnicos_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_orcamento_tecnico" ADD CONSTRAINT "itens_orcamento_tecnico_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamentos_tecnicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_orcamento_tecnico" ADD CONSTRAINT "itens_orcamento_tecnico_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_orcamento_tecnico" ADD CONSTRAINT "itens_orcamento_tecnico_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "variantes_produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamentos_tecnicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sobras_material" ADD CONSTRAINT "sobras_material_origemOrcamentoId_fkey" FOREIGN KEY ("origemOrcamentoId") REFERENCES "orcamentos_tecnicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sobras_material" ADD CONSTRAINT "sobras_material_usadoEmItemId_fkey" FOREIGN KEY ("usadoEmItemId") REFERENCES "itens_orcamento_tecnico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
