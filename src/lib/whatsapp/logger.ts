// Logger estruturado do módulo — estende o padrão que já existia no código
// antigo (console.error("[WA Send]", err)) pra um formato consistente e
// buscável. Ver docs/architecture/whatsapp.md.

interface LogContext {
  correlationId?: string;
  provider?: string;
  sessionId?: string;
  conversationId?: string;
  userId?: string;
  providerMessageId?: string;
}

function formatar(nivel: string, mensagem: string, ctx?: LogContext) {
  return JSON.stringify({ nivel, modulo: "whatsapp", mensagem, ...ctx, timestamp: new Date().toISOString() });
}

export const waLogger = {
  info(mensagem: string, ctx?: LogContext) {
    console.log(formatar("info", mensagem, ctx));
  },
  warn(mensagem: string, ctx?: LogContext) {
    console.warn(formatar("warn", mensagem, ctx));
  },
  error(mensagem: string, ctx?: LogContext & { erro?: unknown }) {
    const { erro, ...resto } = ctx ?? {};
    console.error(
      formatar("error", mensagem, resto as LogContext),
      erro instanceof Error ? erro.message : erro
    );
  },
};
