-- Acesso ao módulo Financeiro é liberado por pessoa (não por cargo).
ALTER TABLE "users" ADD COLUMN "acessoFinanceiro" BOOLEAN NOT NULL DEFAULT false;
