import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!isAdmin(payload.role)) {
      return NextResponse.json({ error: "Apenas administradores podem excluir alertas" }, { status: 403 });
    }

    const alertaId = params.id;

    await prisma.alerta.delete({
      where: { id: alertaId },
    });

    return NextResponse.json({ message: "Alerta excluído com sucesso" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao excluir alerta" }, { status: 500 });
  }
}
