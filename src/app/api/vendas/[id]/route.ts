import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, canViewAll as canViewAllRole } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
