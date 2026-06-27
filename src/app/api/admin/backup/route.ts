import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ORIGEM_MAP: Record<string, string> = {
  "Indicação": "INDICACAO", "Indicacao": "INDICACAO",
  "Site": "SITE",
  "Redes Sociais": "REDES_SOCIAIS",
  "Google Ads": "GOOGLE_ADS",
  "Evento": "EVENTO",
  "Ligação Ativa": "LIGACAO_ATIVA", "Ligacao Ativa": "LIGACAO_ATIVA",
  "Parceiro": "PARCEIRO",
  "Outros": "OUTROS",
};

const TIPO_MAP: Record<string, string> = {
  "Casa": "CASA",
  "Apartamento": "APARTAMENTO",
  "Comercial": "COMERCIAL",
  "Outros": "OUTROS",
};

// ── GET: exporta todos os clientes (com filtro opcional de período) ──────────
export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (payload.role !== "ADMINISTRADOR") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");

  const dateFilter =
    de || ate
      ? {
          createdAt: {
            ...(de ? { gte: new Date(de + "T00:00:00.000Z") } : {}),
            ...(ate ? { lte: new Date(ate + "T23:59:59.999Z") } : {}),
          },
        }
      : {};

  const clientes = await prisma.cliente.findMany({
    where: { deletedAt: null, ...dateFilter },
    include: {
      responsavel: { select: { nome: true } },
      leads: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { estagio: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = clientes.map((c) => ({
    Nome: c.nome,
    "CPF/CNPJ": c.cpfCnpj ?? "",
    Telefone: c.telefone ?? "",
    WhatsApp: c.whatsapp ?? "",
    Email: c.email ?? "",
    "Data Inscrição": c.dataInscricao ? new Date(c.dataInscricao).toISOString().split("T")[0] : "",
    "Tipo Imóvel": c.tipoResidencia ?? "",
    CEP: c.cep ?? "",
    Logradouro: c.logradouro ?? "",
    Número: c.numero ?? "",
    Complemento: c.complemento ?? "",
    Bairro: c.bairro ?? "",
    Cidade: c.cidade ?? "",
    Estado: c.estado ?? "",
    Origem: c.origem ?? "",
    "Serviços Buscados": c.servicoBuscado ?? "",
    Observações: c.observacoes ?? "",
    Vendedor: c.responsavel?.nome ?? "",
    Etapa: c.leads?.[0]?.estagio ?? "",
  }));

  return NextResponse.json({ data: rows, total: rows.length });
}

// ── POST: importa clientes a partir de linhas parseadas ──────────────────────
export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (payload.role !== "ADMINISTRADOR") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await request.json();
  const rows: Record<string, string>[] = body.rows ?? [];

  let criados = 0;
  let ignorados = 0;
  const erros: string[] = [];

  for (const row of rows) {
    const nome = row["Nome"]?.trim();
    if (!nome) { ignorados++; continue; }

    try {
      // Evita duplicata por nome + telefone
      const existente = await prisma.cliente.findFirst({
        where: {
          deletedAt: null,
          nome: { equals: nome, mode: "insensitive" },
          ...(row["Telefone"] ? { telefone: row["Telefone"].trim() } : {}),
        },
      });
      if (existente) { ignorados++; continue; }

      const dataInscricao = row["Data Inscrição"] ? new Date(row["Data Inscrição"]) : undefined;
      const origemRaw = row["Origem"]?.trim();
      const origem = (ORIGEM_MAP[origemRaw] ?? origemRaw ?? "OUTROS") as never;
      const tipoRaw = row["Tipo Imóvel"]?.trim();
      const tipoResidencia = tipoRaw ? (TIPO_MAP[tipoRaw] ?? tipoRaw) as never : undefined;

      const cliente = await prisma.cliente.create({
        data: {
          nome,
          cpfCnpj: row["CPF/CNPJ"]?.trim() || null,
          telefone: row["Telefone"]?.trim() || null,
          whatsapp: row["WhatsApp"]?.trim() || null,
          email: row["Email"]?.trim() || null,
          dataInscricao,
          tipoResidencia,
          cep: row["CEP"]?.trim() || null,
          logradouro: row["Logradouro"]?.trim() || null,
          numero: row["Número"]?.trim() || null,
          complemento: row["Complemento"]?.trim() || null,
          bairro: row["Bairro"]?.trim() || null,
          cidade: row["Cidade"]?.trim() || null,
          estado: row["Estado"]?.trim() || null,
          origem,
          servicoBuscado: row["Serviços Buscados"]?.trim() || null,
          observacoes: row["Observações"]?.trim() || null,
          responsavelId: payload.userId,
          statusOrcamento: "PENDENTE",
          temperatura: "MORNO",
        },
      });

      await prisma.lead.create({
        data: {
          titulo: nome,
          estagio: "NOVO_LEAD",
          origem,
          temperatura: "MORNO",
          responsavelId: payload.userId,
          clienteId: cliente.id,
          ordemKanban: 0,
        },
      });

      criados++;
    } catch (err) {
      erros.push(`${nome}: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  }

  return NextResponse.json({ criados, ignorados, erros });
}
