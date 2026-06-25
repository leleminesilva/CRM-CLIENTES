import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildWhereClause } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ count: 0 }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");
    const userFilter = buildWhereClause(payload.role, payload.userId);

    const count = await prisma.cliente.count({
      where: {
        deletedAt: null,
        ...(since ? { createdAt: { gt: new Date(since) } } : {}),
        ...userFilter,
      },
    });

    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
