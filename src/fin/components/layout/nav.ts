import {
  ArrowDownUpIcon,
  CrownIcon,
  ChartColumnIcon,
  TrendingUpIcon,
  WaypointsIcon,
  GemIcon,
  GaugeIcon,
  TargetIcon,
  BellIcon,
  CalendarDaysIcon,
  LayoutDashboardIcon,
  BadgePercentIcon,
  RepeatIcon,
  CreditCardIcon,
  LayersIcon,
  LandmarkIcon,
  type LucideIcon,
  ReceiptIcon,
  FileUpIcon,
  CalendarCheckIcon,
  SettingsIcon,
  WalletIcon,
  BanknoteIcon,
  FileCheckIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece na barra inferior do celular. */
  mobile?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Só entram aqui módulos prontos — nada de links para telas inexistentes.
 * A ordem dos grupos segue o DS §5.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { href: "/financeiro/painel", label: "Painel", icon: LayoutDashboardIcon, mobile: true },
      { href: "/financeiro/executivo", label: "Visão executiva", icon: CrownIcon },
      { href: "/financeiro/calendario", label: "Calendário", icon: CalendarDaysIcon },
    ],
  },
  {
    label: "Movimentações",
    items: [
      { href: "/financeiro/lancamentos", label: "Lançamentos", icon: ArrowDownUpIcon, mobile: true },
      { href: "/financeiro/receitas", label: "Receitas", icon: WalletIcon },
      { href: "/financeiro/salario", label: "Salário", icon: BanknoteIcon },
      { href: "/financeiro/comissoes", label: "Comissões", icon: BadgePercentIcon },
      { href: "/financeiro/despesas", label: "Despesas", icon: ReceiptIcon },
      { href: "/financeiro/cheques", label: "Cheques", icon: FileCheckIcon },
      { href: "/financeiro/parcelamentos", label: "Parcelamentos", icon: LayersIcon },
      { href: "/financeiro/assinaturas", label: "Assinaturas", icon: RepeatIcon },
      { href: "/financeiro/importar", label: "Importar extrato", icon: FileUpIcon },
    ],
  },
  {
    label: "Análise",
    items: [
      { href: "/financeiro/relatorios", label: "Relatórios", icon: ChartColumnIcon },
      { href: "/financeiro/fechamento", label: "Fechamento do mês", icon: CalendarCheckIcon },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { href: "/financeiro/orcamento", label: "Orçamento", icon: GaugeIcon },
      { href: "/financeiro/metas", label: "Metas", icon: TargetIcon },
      { href: "/financeiro/fluxo-de-caixa", label: "Fluxo de caixa", icon: WaypointsIcon },
      { href: "/financeiro/previsao", label: "Previsão", icon: TrendingUpIcon },
      { href: "/financeiro/patrimonio", label: "Patrimônio", icon: GemIcon },
    ],
  },
  {
    label: "Contas e cartões",
    items: [
      { href: "/financeiro/contas", label: "Contas", icon: LandmarkIcon, mobile: true },
      { href: "/financeiro/cartoes", label: "Cartões", icon: CreditCardIcon, mobile: true },
    ],
  },
];

export const NAV_FOOTER: NavItem[] = [
  { href: "/financeiro/alertas", label: "Alertas", icon: BellIcon },
  { href: "/financeiro/configuracoes", label: "Configurações", icon: SettingsIcon, mobile: true },
];

/** Rota inicial depois do login (muda quando o painel ficar pronto). */
export const HOME_PATH = "/financeiro/painel";

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
