-- Marcação por comissão: o responsável por medidas e projetos fez as medidas / o projeto. Aditiva (padrão: não).
ALTER TABLE "fin_commissions" ADD COLUMN "did_measurements" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "fin_commissions" ADD COLUMN "did_project" BOOLEAN NOT NULL DEFAULT false;
