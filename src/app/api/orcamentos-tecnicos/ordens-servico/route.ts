import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import type { StatusOrdemServico } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "ordens_servico:read")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") as StatusOrdemServico | null) || undefined;

  const ordens = await prisma.ordemServico.findMany({
    where: { deletedAt: null, ...(status ? { status } : {}) },
    include: {
      vendedor: { select: { id: true, nome: true } },
      orcamento: {
        select: {
          id: true, numero: true, valorTotal: true,
          cliente: { select: { id: true, nome: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: ordens });
}
