import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, canViewAll as canViewAllRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { vendaPosVendaSchema } from "@/lib/validators/venda";
import { STATUS_POS_VENDA_LABELS } from "@/lib/utils/formatters";

export const dynamic = "force-dynamic";

// Acompanhamento pós-venda: mover no Kanban (statusPosVenda/ordemKanban) e/ou
// editar vidro chegou, agendamento e observações — usado pela aba "Confirmado".
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "clientes:update");

    const canViewAll = canViewAllRole(payload.role);
    const old = await prisma.venda.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
        ...(canViewAll ? {} : { responsavelId: payload.userId }),
      },
    });
    if (!old) return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });

    const body = await request.json();
    const data = vendaPosVendaSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.statusPosVenda !== undefined) updateData.statusPosVenda = data.statusPosVenda;
    if (data.ordemKanban !== undefined) updateData.ordemKanban = data.ordemKanban;
    if (data.dataAgendamento !== undefined) {
      updateData.dataAgendamento = data.dataAgendamento ? new Date(`${data.dataAgendamento}T12:00:00`) : null;
    }
    if (data.horarioAgendamento !== undefined) updateData.horarioAgendamento = data.horarioAgendamento;
    if (data.observacoesPosVenda !== undefined) updateData.observacoesPosVenda = data.observacoesPosVenda;

    // "vidroChegou" é um toggle vindo do front; se marcado sem data explícita,
    // usa hoje. Se desmarcado, limpa a data de chegada.
    if (data.vidroChegou !== undefined) {
      updateData.vidroChegouEm = data.vidroChegou
        ? new Date(`${data.vidroChegouEm || new Date().toISOString().slice(0, 10)}T12:00:00`)
        : null;
    } else if (data.vidroChegouEm !== undefined) {
      updateData.vidroChegouEm = data.vidroChegouEm ? new Date(`${data.vidroChegouEm}T12:00:00`) : null;
    }

    const venda = await prisma.venda.update({ where: { id: params.id }, data: updateData });

    if (data.statusPosVenda && data.statusPosVenda !== old.statusPosVenda) {
      await prisma.atividade.create({
        data: {
          tipo: "ESTAGIO_ALTERADO",
          descricao: `Pós-venda: "${STATUS_POS_VENDA_LABELS[old.statusPosVenda]}" → "${STATUS_POS_VENDA_LABELS[data.statusPosVenda]}"`,
          userId: payload.userId,
          clienteId: old.clienteId,
          metadata: { de: old.statusPosVenda, para: data.statusPosVenda, vendaId: old.id },
        },
      });
    }

    await createAuditLog({
      userId: payload.userId,
      entidade: "Venda",
      entidadeId: params.id,
      acao: "UPDATE",
      dadosAntigos: { statusPosVenda: old.statusPosVenda, vidroChegouEm: old.vidroChegouEm, dataAgendamento: old.dataAgendamento },
      dadosNovos: updateData,
    });

    return NextResponse.json({ data: venda });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao atualizar venda" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "clientes:update");

    const canViewAll = canViewAllRole(payload.role);
    const venda = await prisma.venda.findFirst({
      where: {
        id: params.id,
        deletedAt: null,
        ...(canViewAll ? {} : { cliente: { responsavelId: payload.userId } }),
      },
    });
    if (!venda) return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });

    await prisma.venda.update({ where: { id: params.id }, data: { deletedAt: new Date() } });

    await createAuditLog({
      userId: payload.userId,
      entidade: "Venda",
      entidadeId: params.id,
      acao: "DELETE",
      dadosAntigos: { numeroOrcamento: venda.numeroOrcamento, valor: venda.valor.toString(), data: venda.data },
    });

    return NextResponse.json({ data: { id: params.id } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao remover venda" }, { status: 500 });
  }
}
