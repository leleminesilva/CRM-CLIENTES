-- Colunas do quadro deixam de ser um enum fixo e viram configuráveis.

CREATE TABLE "whatsapp_etapas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#6366f1',
    "ordem" INTEGER NOT NULL,
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_etapas_pkey" PRIMARY KEY ("id")
);

-- Semeia as 6 etapas atuais (id = rótulo do enum antigo, pra conversas existentes continuarem válidas).
INSERT INTO "whatsapp_etapas" ("id", "nome", "cor", "ordem", "sistema", "updatedAt") VALUES
  ('NOVA',               'Novas',              '#94a3b8', 0, true, CURRENT_TIMESTAMP),
  ('EM_ATENDIMENTO',     'Em atendimento',     '#3b82f6', 1, true, CURRENT_TIMESTAMP),
  ('AGUARDANDO_CLIENTE', 'Aguardando cliente', '#f59e0b', 2, true, CURRENT_TIMESTAMP),
  ('ORCAMENTO_ENVIADO',  'Orçamento enviado',  '#22c55e', 3, true, CURRENT_TIMESTAMP),
  ('FECHADO',            'Fechado',            '#059669', 4, true, CURRENT_TIMESTAMP),
  ('SEM_RETORNO',        'Sem retorno',        '#ef4444', 5, true, CURRENT_TIMESTAMP);

-- whatsapp_conversas.etapa: enum -> texto, preservando os valores.
ALTER TABLE "whatsapp_conversas" ALTER COLUMN "etapa" DROP DEFAULT;
ALTER TABLE "whatsapp_conversas" ALTER COLUMN "etapa" TYPE TEXT USING "etapa"::text;
ALTER TABLE "whatsapp_conversas" ALTER COLUMN "etapa" SET DEFAULT 'NOVA';

DROP TYPE "WhatsAppConversaEtapa";
