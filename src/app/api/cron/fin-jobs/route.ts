import { NextRequest, NextResponse } from "next/server";
import { runDailyJobs } from "@fin/modules/jobs/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Jobs diários do Financeiro (recorrências, faturas, snapshots, lixeira). Chamado pelo Vercel Cron,
// que envia "Authorization: Bearer <CRON_SECRET>". Sem o segredo configurado, a rota fica fechada.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const results = await runDailyJobs();
  return NextResponse.json({ ok: true, results });
}
