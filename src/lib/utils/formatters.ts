import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatRelativeTime(date: string | Date): string {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: ptBR,
  });
}

export function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatCNPJ(cnpj: string): string {
  return cnpj.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5"
  );
}

export function formatCPFCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) return formatCPF(digits);
  return formatCNPJ(digits);
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
}

export function formatCEP(cep: string): string {
  return cep.replace(/(\d{5})(\d{3})/, "$1-$2");
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function maskCPFCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})/, "$1.")
      .replace(/(\d{3})\.(\d{3})/, "$1.$2.")
      .replace(/(\d{3})\.(\d{3})\.(\d{3})/, "$1.$2.$3-")
      .replace(/(\d{3})\.(\d{3})\.(\d{3})-(\d{0,2}).*/, "$1.$2.$3-$4");
  }
  return digits
    .replace(/(\d{2})/, "$1.")
    .replace(/(\d{2})\.(\d{3})/, "$1.$2.")
    .replace(/(\d{2})\.(\d{3})\.(\d{3})/, "$1.$2.$3/")
    .replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})/, "$1.$2.$3/$4-")
    .replace(
      /(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})-(\d{0,2}).*/,
      "$1.$2.$3/$4-$5"
    );
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export const ESTAGIO_LABELS: Record<string, string> = {
  NOVO_LEAD: "Novo Lead",
  CONTATO_INICIAL: "Contato Inicial",
  QUALIFICACAO: "Qualificação",
  PROPOSTA_ENVIADA: "Proposta Enviada",
  NEGOCIACAO: "Negociação",
  FECHADO_GANHO: "Fechado Ganho",
  FECHADO_PERDIDO: "Fechado Perdido",
};

export const STATUS_OPO_LABELS: Record<string, string> = {
  ABERTA: "Aberta",
  GANHA: "Ganha",
  PERDIDA: "Perdida",
  SUSPENSA: "Suspensa",
};

export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  GESTOR: "Gestor",
  COMERCIAL: "Comercial",
  OPERACIONAL: "Operacional",
};

export const PORTE_LABELS: Record<string, string> = {
  MICRO: "Micro",
  PEQUENO: "Pequeno",
  MEDIO: "Médio",
  GRANDE: "Grande",
  ENTERPRISE: "Enterprise",
};

export const ORIGEM_LABELS: Record<string, string> = {
  INDICACAO: "Indicação",
  SITE: "Site",
  REDES_SOCIAIS: "Redes Sociais",
  GOOGLE_ADS: "Google Ads",
  EVENTO: "Evento",
  LIGACAO_ATIVA: "Ligação Ativa",
  PARCEIRO: "Parceiro",
  OUTROS: "Outros",
};

export const TIPO_TAREFA_LABELS: Record<string, string> = {
  REUNIAO: "Reunião",
  LIGACAO: "Ligação",
  VISITA: "Visita",
  FOLLOW_UP: "Follow-up",
  EMAIL: "E-mail",
  TAREFA: "Tarefa",
};

export const TEMPERATURA_LABELS: Record<string, string> = {
  QUENTE: "Quente",
  MORNO: "Morno",
  FRIO: "Frio",
};

export const PRIORIDADE_LABELS: Record<string, string> = {
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};
