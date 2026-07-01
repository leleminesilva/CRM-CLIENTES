import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const primeiro = await prisma.cliente.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (!primeiro) {
    const now = new Date();
    return NextResponse.json({ mes: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` });
  }

  const d = primeiro.createdAt;
  return NextResponse.json({
    mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
  });
}
