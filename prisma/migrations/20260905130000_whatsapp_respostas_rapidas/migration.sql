-- Mensagens pré-definidas (respostas rápidas) editáveis, no lugar da lista fixa no código.
CREATE TABLE "whatsapp_respostas_rapidas" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_respostas_rapidas_pkey" PRIMARY KEY ("id")
);

-- Semeia as 6 mensagens que já existiam fixas no código.
INSERT INTO "whatsapp_respostas_rapidas" ("id", "texto", "ordem", "updatedAt") VALUES
  ('wa_rr_1', 'Bom dia! Como posso ajudar?', 0, CURRENT_TIMESTAMP),
  ('wa_rr_2', 'Pode me passar as medidas (largura × altura)?', 1, CURRENT_TIMESTAMP),
  ('wa_rr_3', 'Qual o tipo de vidro? (temperado, comum, laminado…)', 2, CURRENT_TIMESTAMP),
  ('wa_rr_4', 'Você é de qual cidade?', 3, CURRENT_TIMESTAMP),
  ('wa_rr_5', 'Vou confirmar o valor com a equipe e já te retorno 👍', 4, CURRENT_TIMESTAMP),
  ('wa_rr_6', 'Consegue me mandar uma foto do local?', 5, CURRENT_TIMESTAMP);
