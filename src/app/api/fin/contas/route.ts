import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getFinContext } from "@fin/lib/context";
import { AppError } from "@fin/lib/errors";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

/** Contas ativas do Financeiro novo (usadas pela tela de Carros para a gasolina). */
export async function GET() {
  try {
    const ctx = await getFinContext();
    if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: noStore });
    const accounts = await prisma.account.findMany({
      where: { workspaceId: ctx.workspaceId, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    });
    return NextResponse.json({ data: accounts }, { headers: noStore });
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403, headers: noStore });
    }
    throw error;
  }
}
