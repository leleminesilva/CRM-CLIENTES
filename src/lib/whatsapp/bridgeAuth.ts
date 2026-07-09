import { NextRequest } from "next/server";

// Autenticação simples por segredo compartilhado para as rotas /api/whatsapp/bridge/*.
// O bridge é um processo local (fora do navegador) sem sessão/cookie de usuário, então
// usa um header com um token fixo em vez do fluxo JWT normal do resto do app.
export function bridgeAutenticado(request: NextRequest): boolean {
  const secret = process.env.WHATSAPP_BRIDGE_SECRET;
  if (!secret) return false;
  return request.headers.get("x-bridge-secret") === secret;
}
