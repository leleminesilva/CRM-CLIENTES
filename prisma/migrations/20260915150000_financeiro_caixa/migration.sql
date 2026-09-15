-- CreateEnum
CREATE TYPE "FinanceiroContaTipo" AS ENUM ('CAIXA', 'CORRENTE', 'POUPANCA', 'INVESTIMENTO', 'CARTAO');

-- CreateEnum
CREATE TYPE "FinanceiroOrigem" AS ENUM ('MANUAL', 'OPEN_FINANCE');

-- CreateEnum
CREATE TYPE "FinanceiroTipoLancamento" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateTable
CREATE TABLE "financeiro_contas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "FinanceiroContaTipo" NOT NULL DEFAULT 'CAIXA',
    "origem" "FinanceiroOrigem" NOT NULL DEFAULT 'MANUAL',
    "instituicao" TEXT,
    "saldoInicial" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cor" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "pluggyItemId" TEXT,
    "pluggyAccountId" TEXT,
    "ultimaSincronizacao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financeiro_contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financeiro_categorias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "FinanceiroTipoLancamento" NOT NULL,
    "cor" TEXT,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financeiro_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financeiro_lancamentos" (
    "id" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "categoriaId" TEXT,
    "tipo" "FinanceiroTipoLancamento" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "origem" "FinanceiroOrigem" NOT NULL DEFAULT 'MANUAL',
    "pluggyTransactionId" TEXT,
    "criadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financeiro_lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financeiro_contas_pluggyAccountId_key" ON "financeiro_contas"("pluggyAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "financeiro_categorias_nome_tipo_key" ON "financeiro_categorias"("nome", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "financeiro_lancamentos_pluggyTransactionId_key" ON "financeiro_lancamentos"("pluggyTransactionId");

-- CreateIndex
CREATE INDEX "financeiro_lancamentos_contaId_data_idx" ON "financeiro_lancamentos"("contaId", "data");

-- CreateIndex
CREATE INDEX "financeiro_lancamentos_categoriaId_idx" ON "financeiro_lancamentos"("categoriaId");

-- AddForeignKey
ALTER TABLE "financeiro_lancamentos" ADD CONSTRAINT "financeiro_lancamentos_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "financeiro_contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financeiro_lancamentos" ADD CONSTRAINT "financeiro_lancamentos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "financeiro_categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financeiro_lancamentos" ADD CONSTRAINT "financeiro_lancamentos_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: categorias padrão (o usuário pode editar/excluir/criar outras depois)
INSERT INTO "financeiro_categorias" ("id", "nome", "tipo", "cor", "padrao", "createdAt") VALUES
    ('fin_cat_venda',       'Vendas',            'ENTRADA', '#10b981', true, CURRENT_TIMESTAMP),
    ('fin_cat_servico',     'Serviços',          'ENTRADA', '#059669', true, CURRENT_TIMESTAMP),
    ('fin_cat_outras_rec',  'Outras receitas',   'ENTRADA', '#34d399', true, CURRENT_TIMESTAMP),
    ('fin_cat_fornecedor',  'Fornecedores',      'SAIDA',   '#ef4444', true, CURRENT_TIMESTAMP),
    ('fin_cat_salario',     'Salários',          'SAIDA',   '#f97316', true, CURRENT_TIMESTAMP),
    ('fin_cat_aluguel',     'Aluguel',           'SAIDA',   '#f59e0b', true, CURRENT_TIMESTAMP),
    ('fin_cat_imposto',     'Impostos',          'SAIDA',   '#dc2626', true, CURRENT_TIMESTAMP),
    ('fin_cat_marketing',   'Marketing',         'SAIDA',   '#8b5cf6', true, CURRENT_TIMESTAMP),
    ('fin_cat_outras_desp', 'Outras despesas',   'SAIDA',   '#6b7280', true, CURRENT_TIMESTAMP);

-- Seed: conta "Caixa" padrão, pra já dar pra lançar sem precisar cadastrar uma conta antes
INSERT INTO "financeiro_contas" ("id", "nome", "tipo", "origem", "saldoInicial", "cor", "ativa", "createdAt", "updatedAt") VALUES
    ('fin_conta_caixa', 'Caixa', 'CAIXA', 'MANUAL', 0, '#10b981', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
