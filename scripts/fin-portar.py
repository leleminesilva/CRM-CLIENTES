#!/usr/bin/env python3
"""Porta arquivos de Financeiro/src (Next 16, Prisma 7, Zod 4) para src/fin (stack do CRM).

Uso: python3 scripts/fin-portar.py <caminho relativo a Financeiro/src> [...]
     (ex.: lib/money.ts modules/accounts)

Regras aplicadas em todo arquivo (o que não cabe aqui é ajustado à mão depois):
- imports @/lib, @/modules, @/components → @fin/...; client gerado do Prisma 7 → @prisma/client;
- pacote unificado "radix-ui" → pacotes @radix-ui/react-* (os que o CRM já usa);
- Zod 4 → Zod 3: z.uuid()/url()/email() → z.string().uuid()...; mensagens como { message };
- modelo AuditLog do sistema novo se chama FinAuditLog no CRM;
- SQL bruto: tabelas ganham o prefixo fin_ (FROM/JOIN/INTO/UPDATE) e a função de busca é fin_immutable_unaccent;
- Tailwind 4 → 3: "importante" vai para o início do utilitário (text-ink! → !text-ink);
- rotas do app novo ficam sob /financeiro (ex.: "/contas" → "/financeiro/contas"); as de API, sob /api/fin;
- destino: páginas em src/app/financeiro/(fin), rotas de API em src/app/api/fin, o resto em src/fin.
Testes (*.test.ts) não são copiados.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "Financeiro" / "src"
DST = ROOT / "src" / "fin"

TABLES = [
    "workspaces", "workspace_members", "accounts", "categories", "transactions", "recurrences",
    "subscriptions", "commissions", "credit_cards", "credit_card_invoices", "installment_plans",
    "budgets", "goals", "goal_contributions", "assets", "asset_valuations", "liabilities",
    "financial_snapshots", "attachments", "notifications", "import_batches", "audit_logs",
    "job_runs", "month_closes",
]

ROUTES = [
    "assinaturas", "alertas", "calendario", "cartoes", "comissoes", "configuracoes", "contas",
    "despesas", "executivo", "fechamento", "fluxo-de-caixa", "importar", "lancamentos", "lixeira",
    "metas", "orcamento", "painel", "parcelamentos", "patrimonio", "previsao", "receitas",
    "relatorios", "categorias",
]


def kebab(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "-", name).lower()


def radix_imports(match: re.Match) -> str:
    # import { Dialog as DialogPrimitive, Slot } from "radix-ui" → um import por pacote @radix-ui/react-*
    lines = []
    for part in match.group(1).split(","):
        part = part.strip()
        if not part:
            continue
        name, _, alias = part.partition(" as ")
        lines.append(f'import * as {(alias or name).strip()} from "@radix-ui/react-{kebab(name.strip())}";')
    return "\n".join(lines)


def transform(text: str) -> str:
    text = re.sub(r'import \{([^}]+)\} from "radix-ui";', radix_imports, text)
    text = re.sub(r'(["\'])@/generated/prisma(?:/[a-z]+)?\1', r'\1@prisma/client\1', text)
    for folder in ("lib", "modules", "components"):
        text = text.replace(f'"@/{folder}/', f'"@fin/{folder}/')
    text = re.sub(r"\bz\.(uuid|url|email)\(", r"z.string().\1(", text)
    # Zod 4 aceita a mensagem como string ou { error }; o 3 só { message }.
    text = re.sub(r"\bz\.enum\(([A-Za-z_][A-Za-z0-9_]*), (\"[^\"]*\")\)", r"z.enum(\1, { message: \2 })", text)
    text = re.sub(r"(\bz\.literal\([^()]*), \{ error: ", r"\1, { message: ", text)
    text = re.sub(r"\.auditLog\b", ".finAuditLog", text)
    text = re.sub(r"\bPrisma\.AuditLog", "Prisma.FinAuditLog", text)

    if re.search(r"Prisma\.sql|\$queryRaw|\$executeRaw", text):
        tables = "|".join(sorted(TABLES, key=len, reverse=True))
        text = re.sub(rf"\b(FROM|JOIN|INTO|UPDATE)\s+({tables})\b", r"\1 fin_\2", text)
        text = text.replace("immutable_unaccent(", "fin_immutable_unaccent(").replace(
            "fin_fin_immutable_unaccent(", "fin_immutable_unaccent("
        )

    # Tailwind 4 marca "importante" no fim (hover:text-ink!); o 3, no começo do utilitário (hover:!text-ink).
    text = re.sub(
        r"(?<=[\s\"'`])((?:[a-z0-9\-\[\]=&_.:]+:)?)([a-z][a-z0-9\-\[\]/.()#%_]*-[a-z0-9\-\[\]/.()#%_]+)!(?=[\s\"'`])",
        r"\1!\2",
        text,
    )

    # Rotas de API do sistema novo ficam em /api/fin/* no CRM.
    text = re.sub(r"([\"'`])/api/(busca|exportar|arquivos|relatorios)\b", r"\1/api/fin/\2", text)

    # duration-[120ms] é ambíguo no Tailwind 3 com tailwindcss-animate: usa os nomes do tema.
    text = re.sub(r"\bduration-\[(120|280)ms\]", r"duration-\1", text)

    routes = "|".join(sorted(ROUTES, key=len, reverse=True))
    text = re.sub(rf"([\"'`])/({routes})(?=[\"'`/?#$])", r"\1/financeiro/\2", text)
    return text


# Escritos à mão para o CRM: a conversão nunca os sobrescreve.
HANDWRITTEN = {"app/(app)/layout.tsx"}


def destination(f: pathlib.Path) -> pathlib.Path:
    rel = f.relative_to(SRC)
    parts = rel.parts
    # Páginas: app/(app)/x → src/app/financeiro/(fin)/x · API: app/api/x → src/app/api/fin/x
    if parts[:2] == ("app", "(app)"):
        return ROOT / "src" / "app" / "financeiro" / "(fin)" / pathlib.Path(*parts[2:])
    if parts[:2] == ("app", "api"):
        return ROOT / "src" / "app" / "api" / "fin" / pathlib.Path(*parts[2:])
    return DST / rel


def port(rel: str) -> list[str]:
    src = SRC / rel
    files = [src] if src.is_file() else sorted(p for p in src.rglob("*") if p.is_file())
    written = []
    for f in files:
        if f.suffix not in (".ts", ".tsx") or ".test." in f.name:
            continue
        if str(f.relative_to(SRC)) in HANDWRITTEN:
            continue
        out = destination(f)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(transform(f.read_text()))
        written.append(str(out.relative_to(ROOT)))
    return written


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        for path in port(arg):
            print(path)
