import { NextResponse } from "next/server";
import { getFinContext } from "@fin/lib/context";
import { AppError } from "@fin/lib/errors";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

/** Quem está no Financeiro, com qual papel, em qual workspace e qual é o "hoje" dele. */
export async function GET() {
  try {
    const ctx = await getFinContext();
    if (!ctx) return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: noStore });
    return NextResponse.json({ data: ctx }, { headers: noStore });
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403, headers: noStore });
    }
    throw error;
  }
}
