#!/usr/bin/env python3
"""Ajustes manuais do port do Financeiro, aplicados depois de scripts/fin-portar.py.

O que a conversão automática não resolve fica aqui, para que portar de novo seja reproduzível.
Idempotente: rodar duas vezes não muda nada na segunda.

Uso: python3 scripts/fin-ajustes.py
"""
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
FIN = ROOT / "src" / "fin"
APP = ROOT / "src" / "app" / "financeiro" / "(fin)"

# Partes do sistema novo que não se aplicam ao CRM:
# - auth/perfil/segurança: o login é o do CRM; demo e troca de workspace: há um só workspace;
# - backup: pg_dump + disco local não existem na Vercel (o Supabase faz backup do banco).
REMOVE = [
    FIN / "modules" / "auth",
    FIN / "modules" / "demo",
    FIN / "modules" / "backup",
    FIN / "modules" / "workspace" / "components" / "workspace-settings.tsx",
    FIN / "components" / "layout" / "user-menu.tsx",
    FIN / "components" / "layout" / "topbar.tsx",
    APP / "configuracoes" / "perfil",
    APP / "configuracoes" / "seguranca",
    APP / "configuracoes" / "workspace",
    ROOT / "src" / "app" / "api" / "fin" / "auth",
    ROOT / "src" / "app" / "api" / "fin" / "backup",
]


def edit(rel: str, old: str, new: str) -> None:
    path = ROOT / rel
    if not path.exists():
        return
    text = path.read_text()
    if old in text:
        path.write_text(text.replace(old, new))
    elif new not in text:
        raise SystemExit(f"{rel}: trecho não encontrado (o original mudou?):\n{old[:120]}")


def cut(rel: str, start: str, end: str, keep_end: bool = True) -> None:
    """Remove de `start` até `end` (exclusive se keep_end). Sem efeito se `start` não existe."""
    path = ROOT / rel
    if not path.exists():
        return
    text = path.read_text()
    i = text.find(start)
    if i < 0:
        return
    j = text.index(end, i)
    path.write_text(text[:i] + (text[j:] if keep_end else text[j + len(end):]))


# Textos de finanças pessoais → empresa (Infinity Glass). (arquivo, antes, depois)
M = "src/fin/modules/"
A = "src/app/financeiro/(fin)/"
TEXTOS = [
    # Classes de receita: Receita principal · Comissões · Receitas extras · Outras
    (M + "categories/types.ts", 'BASE: "Base (salário)",', 'BASE: "Receita principal",'),
    (M + "categories/types.ts", 'EXTRA: "Renda extra",\n  OTHER: "Outros",', 'EXTRA: "Receitas extras",\n  OTHER: "Outras",'),
    (M + "transactions/components/income-class-cards.tsx", 'BASE: "Base (salário)",', 'BASE: "Receita principal",'),
    (M + "transactions/components/income-class-cards.tsx", 'EXTRA: "Renda extra",', 'EXTRA: "Receitas extras",'),
    (M + "reports/aggregate.ts", 'BASE: "Base",', 'BASE: "Receita principal",'),
    (M + "reports/aggregate.ts", 'EXTRA: "Renda extra",\n  OTHER: "Outros",', 'EXTRA: "Receitas extras",\n  OTHER: "Outras",'),
    (A + "painel/page.tsx", 'BASE: "Base",', 'BASE: "Receita principal",'),
    (A + "painel/page.tsx", 'EXTRA: "Renda extra",\n  OTHER: "Outros",', 'EXTRA: "Receitas extras",\n  OTHER: "Outras",'),
    (M + "reports/definitions.ts", '"Base, comissões, renda extra e outros, mês a mês."', '"Receita principal, comissões, receitas extras e outras, mês a mês."'),
    # Página de receitas
    (A + "receitas/page.tsx", 'export const metadata: Metadata = { title: "Minha renda" };', 'export const metadata: Metadata = { title: "Receitas" };'),
    (A + "receitas/page.tsx", 'title="Minha renda"', 'title="Receitas"'),
    (A + "receitas/page.tsx", '"Salário base, comissões e rendas extras do mês, pelo mês da previsão de recebimento."', '"Vendas, serviços, comissões e receitas extras, pelo mês da previsão de recebimento."'),
    (A + "receitas/page.tsx", '"Cadastre sua renda base (ela se repete todo mês) e vá adicionando comissões e rendas extras."', '"Cadastre as receitas que se repetem todo mês e vá lançando vendas, serviços e receitas extras."'),
    (M + "transactions/components/income-actions.tsx", 'description: "Salário",', 'description: "Receita mensal",'),
    (M + "transactions/components/income-actions.tsx", "<WalletIcon /> Cadastrar renda base", "<WalletIcon /> Cadastrar receita recorrente"),
    # Despesas fixas × receita principal
    (M + "transactions/components/fixed-expenses-summary.tsx", "Da renda base comprometida", "Da receita principal comprometida"),
    (M + "transactions/components/fixed-expenses-summary.tsx", " de\n              renda base\n", " de\n              receita principal\n"),
    (M + "transactions/components/fixed-expenses-summary.tsx", '"Cadastre a renda base para ver este indicador"', '"Cadastre a receita principal recorrente para ver este indicador"'),
    (M + "insights/rules.ts", "Suas despesas fixas representam ${formatPercent(fixed.shareOfBase)} da sua renda base.", "As despesas fixas representam ${formatPercent(fixed.shareOfBase)} da receita principal."),
    (M + "insights/rules.ts", "Suas comissões representam ${formatPercent(commission.dividedBy(total))} da sua renda total nos últimos 3 meses.", "As comissões representam ${formatPercent(commission.dividedBy(total))} da receita total nos últimos 3 meses."),
    # Previsão e visão executiva
    (A + "previsao/page.tsx", '"Renda base, comissões típicas, despesas fixas, parcelas e faturas projetadas', '"Receitas recorrentes, comissões típicas, despesas fixas, parcelas e faturas projetadas'),
    (A + "executivo/page.tsx", 'question="Quanto minha renda cresceu?"', 'question="Quanto a receita cresceu?"'),
    (A + "executivo/page.tsx", "salário e contas fixas futuras não entram", "receitas e contas fixas futuras não entram"),
    # Reserva de emergência → reserva de caixa
    (M + "goals/components/goals-view.tsx", "previsão de quando você chega lá — incluindo a reserva de emergência.", "previsão de quando cada meta é atingida — incluindo a reserva de caixa."),
    (M + "goals/components/goals-view.tsx", '<h2 className="title-section">Reserva de emergência</h2>', '<h2 className="title-section">Reserva de caixa</h2>'),
    (M + "goals/components/goals-view.tsx", 'title="Cadastre sua reserva de emergência"', 'title="Cadastre a reserva de caixa"'),
    (M + "goals/components/goal-form-dialog.tsx", 'EMERGENCY_FUND: "Reserva de emergência",', 'EMERGENCY_FUND: "Reserva de caixa",'),
    (M + "goals/components/goal-form-dialog.tsx", '"Reserva de emergência" : ""', '"Reserva de caixa" : ""'),
    (M + "alerts/rules.ts", "title: `Sua reserva cobre ${fund.months", "title: `A reserva de caixa cobre ${fund.months"),
    # Primeiros passos
    (M + "onboarding/components/onboarding-checklist.tsx", 'title: "Informe sua renda base",', 'title: "Cadastre as receitas recorrentes",'),
    (M + "onboarding/components/onboarding-checklist.tsx", 'hint: "O salário que entra todo mês (ex.: 5º dia útil).",', 'hint: "Contratos e entradas fixas que caem todo mês.",'),
    (M + "onboarding/components/onboarding-checklist.tsx", 'hint: "Aluguel, internet, academia: marque “Repetir”.",', 'hint: "Aluguel, internet, salários: marque “Repetir”.",'),
    (M + "onboarding/components/onboarding-checklist.tsx", "Cinco passos para o painel refletir a sua vida financeira.", "Cinco passos para o painel refletir o caixa da empresa."),
    # Exemplos
    (A + "despesas/page.tsx", "Cadastre aluguel, internet, academia… marcando “Repetir”.", "Cadastre aluguel, internet, salários… marcando “Repetir”."),
    (M + "subscriptions/components/subscriptions-view.tsx", '"Adobe, Netflix, Spotify, iCloud, academia… Cadastre e descubra quanto gasta por ano com serviços recorrentes."', '"Sistema de gestão, internet, telefonia, softwares… Cadastre e descubra quanto a empresa gasta por ano com serviços recorrentes."'),
    (M + "installments/components/plan-form-dialog.tsx", 'placeholder="Ex.: Sony FX30"', 'placeholder="Ex.: Máquina de corte de vidro"'),
    (M + "calendar/components/calendar-view.tsx", 'salary: { label: "Salário",', 'salary: { label: "Receita recorrente",'),
    (M + "onboarding/components/onboarding-checklist.tsx", 'description: "Salário",', 'description: "Receita mensal",'),
]


def main() -> None:
    for path in REMOVE:
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()

    # Jobs diários: sem backup (ver REMOVE).
    edit("src/fin/modules/jobs/runner.ts", 'import { createBackup } from "@fin/modules/backup/service";\n', "")
    edit(
        "src/fin/modules/jobs/runner.ts",
        """  // Backup primeiro: protege os dados antes de qualquer job que escreva.
  results["backup.auto"] = await runOnce("backup.auto", today, async () => {
    const manifest = await createBackup("auto");
    return { id: manifest.id, bytes: manifest.dumpBytes };
  });
""",
        "  // No CRM não há backup aqui: o banco fica no Supabase, que tem backup próprio.\n",
    )

    # Workspace: só renomear/excluir; sem troca de workspace nem demonstração.
    ws = "src/fin/modules/workspace/actions.ts"
    edit(ws, 'import { setActiveWorkspace } from "@fin/lib/context";\n', "")
    edit(ws, 'import { createDemoWorkspace } from "@fin/modules/demo/service";\n', "")
    cut(ws, "export const switchWorkspaceAction", "export const renameWorkspaceAction")
    path = ROOT / ws
    text = path.read_text()
    if "export const createDemoWorkspaceAction" in text:
        text = text[: text.index("export const createDemoWorkspaceAction")].rstrip("\n") + "\n"
    note = "// No CRM há um único workspace (o da empresa): sem troca de workspace nem workspace de demonstração.\n"
    if note not in text:
        text = text.replace('"use server";\n', '"use server";\n\n' + note, 1)
    path.write_text(text)

    # Primeiros passos: sem o convite para a demonstração.
    ob = "src/fin/modules/onboarding/components/onboarding-checklist.tsx"
    edit(ob, 'import { createDemoWorkspaceAction } from "@fin/modules/workspace/actions";\n', "")
    cut(ob, '      <p className="text-[13px] text-ink-2">\n        Prefere explorar antes?', "      </p>\n", keep_end=False)
    # Sem a demonstração, o router ficou sem uso.
    edit(ob, "  const router = useRouter();\n", "")
    edit(ob, 'import { useRouter } from "next/navigation";\n', "")

    # Configurações: sem perfil/segurança/workspace (ver REMOVE); abre em Categorias.
    cfg = "src/app/financeiro/(fin)/configuracoes/layout.tsx"
    edit(
        cfg,
        """  { href: "/financeiro/configuracoes/perfil", label: "Perfil" },
  { href: "/financeiro/configuracoes/seguranca", label: "Segurança" },
  { href: "/financeiro/configuracoes/workspace", label: "Workspace" },
""",
        "",
    )
    edit(cfg, '{ href: "/financeiro/configuracoes/dados", label: "Dados e backup" }', '{ href: "/financeiro/configuracoes/dados", label: "Dados" }')
    edit(cfg, "Perfil, segurança, workspace, categorias, lixeira, exportação e backups.", "Categorias, lixeira e exportação dos dados.")
    edit("src/app/financeiro/(fin)/configuracoes/page.tsx", 'redirect("/financeiro/configuracoes/perfil")', 'redirect("/financeiro/configuracoes/categorias")')

    # Dados: só exportação (sem backup/restauração, ver REMOVE).
    dados = "src/app/financeiro/(fin)/configuracoes/dados/page.tsx"
    edit(dados, 'import { can } from "@fin/lib/permissions";\n', "")
    edit(dados, 'import { BackupManager } from "@fin/modules/backup/components/backup-manager";\n', "")
    edit(dados, 'import { listBackupDTOs } from "@fin/modules/backup/queries";\n', "")
    edit(dados, 'export const metadata: Metadata = { title: "Dados e backup" };', 'export const metadata: Metadata = { title: "Dados" };')
    edit(dados, "  const owner = can(ctx, \"owner\");\n", "")
    edit(dados, """            . Para uma cópia que restaura o sistema inteiro, use os backups abaixo.""", """            .""")
    cut(dados, "      {owner ? (", "    </div>\n  );\n}")

    # Empresa, não finanças pessoais.
    edit("src/fin/components/layout/nav.ts", 'label: "Minha renda"', 'label: "Receitas"')

    for arquivo, antes, depois in TEXTOS:
        edit(arquivo, antes, depois)

    # React 18: props do campo de valor sem `ref` no tipo (o forwardRef já o declara).
    edit(
        "src/fin/components/shared/money-input.tsx",
        'type MoneyInputProps = Omit<React.ComponentProps<"input">, "type" | "inputMode">;',
        'type MoneyInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "type" | "inputMode">;',
    )


if __name__ == "__main__":
    main()
    print("ajustes aplicados")
