import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import prisma from "@/lib/prisma";
import { sobraMaterialSchema } from "@/lib/validators/sobraMaterial";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "sobras_material:read")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const sobras = await prisma.sobraMaterial.findMany({
    where: { deletedAt: null },
    orderBy: [{ disponivel: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ data: sobras });
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "sobras_material:create")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await request.json();
  const data = sobraMaterialSchema.parse(body);

  const sobra = await prisma.sobraMaterial.create({ data });
  await createAuditLog({ userId: payload.userId, entidade: "SobraMaterial", entidadeId: sobra.id, acao: "CREATE", dadosNovos: data });

  return NextResponse.json({ data: sobra }, { status: 201 });
}
