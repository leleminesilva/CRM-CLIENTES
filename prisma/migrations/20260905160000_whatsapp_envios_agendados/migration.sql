-- Envio agendado (mensagem automática com atraso), processado sem cron.
CREATE TABLE "whatsapp_envios_agendados" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "enviarEm" TIMESTAMP(3) NOT NULL,
    "enviadoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "processandoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_envios_agendados_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_envios_agendados_enviadoEm_canceladoEm_enviarEm_idx"
  ON "whatsapp_envios_agendados"("enviadoEm", "canceladoEm", "enviarEm");
