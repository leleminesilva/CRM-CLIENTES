// Módulos do CRM desligados a pedido (07/10/2026; WhatsApp em 08/10/2026). Somem do menu, o endereço volta para o
// início (middleware) e nada deles roda em segundo plano (contador do chat, lembretes e
// tarefas do dia no sino). O código e os dados continuam: para religar, tire o módulo daqui.
export const MODULOS_DESLIGADOS = ["/chat", "/agenda", "/tarefas", "/confirmados", "/pesquisa", "/whatsapp"] as const;

/** true se a rota pertence a um módulo desligado (ex.: "/agenda" ou "/agenda/123"). */
export function moduloDesligado(pathname: string): boolean {
  return MODULOS_DESLIGADOS.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}
