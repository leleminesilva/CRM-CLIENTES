import { NextResponse } from "next/server";
import { getContext } from "@fin/lib/context";
import { logger } from "@fin/lib/logger";
import { buildExportZip, buildWorkspaceExport, exportToJson } from "@fin/modules/export/service";

/** Exportação completa do workspace: GET /api/exportar?formato=json|zip */
export async function GET(request: Request) {
  const ctx = await getContext();
  if (!ctx) return new NextResponse("Sessão expirada.", { status: 401 });
  const format = new URL(request.url).searchParams.get("formato") ?? "json";
  if (format !== "json" && format !== "zip")
    return new NextResponse("Formato inválido.", { status: 400 });
  const headers = (type: string, ext: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="controle-de-gasto-${ctx.today}.${ext}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  try {
    if (format === "json")
      return new NextResponse(exportToJson(await buildWorkspaceExport(ctx)), {
        headers: headers("application/json; charset=utf-8", "json"),
      });
    return new NextResponse(new Uint8Array(await buildExportZip(ctx)), {
      headers: headers("application/zip", "zip"),
    });
  } catch (error) {
    logger.error({ err: error }, "Falha ao exportar dados");
    return new NextResponse("Não foi possível gerar a exportação.", { status: 500 });
  }
}
