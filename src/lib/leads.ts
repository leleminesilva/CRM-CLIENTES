import prisma from "@/lib/prisma";

/**
 * Promove leads cancelados cuja data de "próximo contato" já chegou para o
 * estágio REENGAJAR, e reordena o Kanban para que apareçam no topo. Também
 * volta o status do orçamento do cliente para PENDENTE e toca o updatedAt
 * do cliente para que ele suba ao topo da lista de Clientes (mesma ordenação
 * usada para novas notificações).
 */
export async function promoverLeadsParaReengajar(): Promise<void> {
  const pendentes = await prisma.lead.findMany({
    where: {
      estagio: "FECHADO_PERDIDO",
      deletedAt: null,
      proximoContato: { lte: new Date() },
    },
    select: { id: true, clienteId: true },
  });

  if (pendentes.length === 0) return;

  const leadIds = pendentes.map((l) => l.id);
  const clienteIds = pendentes
    .map((l) => l.clienteId)
    .filter((id): id is string => !!id);

  await prisma.lead.updateMany({
    where: { id: { in: leadIds } },
    data: { estagio: "REENGAJAR", proximoContato: null, ordemKanban: -1_000_000 },
  });

  if (clienteIds.length > 0) {
    await prisma.cliente.updateMany({
      where: { id: { in: clienteIds } },
      data: { statusOrcamento: "PENDENTE", updatedAt: new Date() },
    });
  }
}
