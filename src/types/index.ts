export type Role = "ADMINISTRADOR" | "GESTOR" | "COMERCIAL" | "OPERACIONAL";
export type Porte = "MICRO" | "PEQUENO" | "MEDIO" | "GRANDE" | "ENTERPRISE";
export type OrigemCliente =
  | "INDICACAO"
  | "SITE"
  | "REDES_SOCIAIS"
  | "GOOGLE_ADS"
  | "EVENTO"
  | "LIGACAO_ATIVA"
  | "PARCEIRO"
  | "OUTROS";
export type EstagioLead =
  | "NOVO_LEAD"
  | "CONTATO_INICIAL"
  | "PRIMEIRO_ORCAMENTO"
  | "QUALIFICACAO"
  | "PROPOSTA_ENVIADA"
  | "NEGOCIACAO"
  | "FECHADO_GANHO"
  | "FECHADO_PERDIDO";
export type Temperatura = "QUENTE" | "MORNO" | "FRIO";
export type StatusOrcamentoCliente = "PENDENTE" | "APROVADO" | "NAO_APROVADO";
export type StatusOportunidade = "ABERTA" | "GANHA" | "PERDIDA" | "SUSPENSA";
export type TipoTarefa =
  | "REUNIAO"
  | "LIGACAO"
  | "VISITA"
  | "FOLLOW_UP"
  | "EMAIL"
  | "TAREFA";
export type StatusTarefa =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "CANCELADA"
  | "ATRASADA";
export type Prioridade = "ALTA" | "MEDIA" | "BAIXA";
export type TipoAtividade =
  | "CRIACAO"
  | "EDICAO"
  | "ESTAGIO_ALTERADO"
  | "COMENTARIO"
  | "TAREFA_CRIADA"
  | "TAREFA_CONCLUIDA"
  | "LIGACAO"
  | "EMAIL"
  | "REUNIAO"
  | "ANEXO_ADICIONADO";
export type TipoNotificacao =
  | "LEAD_NOVO"
  | "TAREFA_VENCENDO"
  | "OPORTUNIDADE_PARADA"
  | "CLIENTE_SEM_CONTATO"
  | "SISTEMA";

export interface User {
  id: string;
  nome: string;
  email: string;
  role: Role;
  avatar?: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Empresa {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  segmento?: string | null;
  porte: Porte;
  website?: string | null;
  telefone?: string | null;
  email?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  observacoes?: string | null;
  _count?: { contatos: number };
  createdAt: string;
  updatedAt: string;
}

export interface Contato {
  id: string;
  nome: string;
  cargo?: string | null;
  email?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  cpf?: string | null;
  avatar?: string | null;
  principal: boolean;
  observacoes?: string | null;
  empresaId?: string | null;
  empresa?: Empresa | null;
  createdAt: string;
  updatedAt: string;
}

export interface Cliente {
  id: string;
  nome: string;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  cpfCnpj?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  tipoResidencia?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  segmento?: string | null;
  porte?: Porte | null;
  origem: OrigemCliente;
  responsavelId?: string | null;
  responsavel?: User | null;
  empresaId?: string | null;
  empresa?: Empresa | null;
  contatoId?: string | null;
  contato?: Contato | null;
  observacoes?: string | null;
  // Fluxo de atendimento
  dataInscricao?: string | null;
  servicoBuscado?: string | null;
  numeroOrcamento?: string | null;
  valorOrcamento?: number | null;
  prazoOrcamento?: string | null;
  dataVenda?: string | null;
  statusOrcamento: StatusOrcamentoCliente;
  orcamentoEnviadoEm?: string | null;
  revisadoEm?: string | null;
  temperatura: Temperatura;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  titulo: string;
  descricao?: string | null;
  estagio: EstagioLead;
  ordemKanban: number;
  valorEstimado?: number | null;
  temperatura: Temperatura;
  origem: OrigemCliente;
  responsavelId?: string | null;
  responsavel?: User | null;
  clienteId?: string | null;
  cliente?: Cliente | null;
  empresaId?: string | null;
  empresa?: Empresa | null;
  contatoId?: string | null;
  contato?: Contato | null;
  dataFechamento?: string | null;
  motivoPerda?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Oportunidade {
  id: string;
  titulo: string;
  descricao?: string | null;
  valor: number;
  probabilidade: number;
  status: StatusOportunidade;
  dataPrevisao?: string | null;
  dataFechamento?: string | null;
  responsavelId?: string | null;
  responsavel?: User | null;
  clienteId?: string | null;
  cliente?: Cliente | null;
  empresaId?: string | null;
  empresa?: Empresa | null;
  contatoId?: string | null;
  contato?: Contato | null;
  leadId?: string | null;
  lead?: Lead | null;
  motivoPerda?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string | null;
  tipo: TipoTarefa;
  status: StatusTarefa;
  prioridade: Prioridade;
  dataVencimento: string;
  horario?: string | null;
  dataInicio?: string | null;
  dataConclusao?: string | null;
  responsavelId?: string | null;
  responsavel?: User | null;
  clienteId?: string | null;
  cliente?: Cliente | null;
  leadId?: string | null;
  lead?: Lead | null;
  oportunidadeId?: string | null;
  oportunidade?: Oportunidade | null;
  createdAt: string;
  updatedAt: string;
}

export interface Atividade {
  id: string;
  tipo: TipoAtividade;
  descricao: string;
  userId: string;
  user: User;
  clienteId?: string | null;
  leadId?: string | null;
  oportunidadeId?: string | null;
  contatoId?: string | null;
  empresaId?: string | null;
  tarefaId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Comentario {
  id: string;
  texto: string;
  userId: string;
  user: User;
  clienteId?: string | null;
  leadId?: string | null;
  oportunidadeId?: string | null;
  contatoId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: TipoNotificacao;
  lida: boolean;
  userId: string;
  linkUrl?: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  user: User;
  entidade: string;
  entidadeId: string;
  acao: string;
  dadosAntigos?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface DashboardKPIs {
  totalClientes: number;
  leadsAtivos: number;
  oportunidadesAbertas: number;
  valorNegociacao: number;
  vendasFechadas: number;
  taxaConversao: number;
  ticketMedio: number;
  faturamentoPrevisto: number;
  variacaoClientes: number;
  variacaoLeads: number;
  variacaoOportunidades: number;
  variacaoVendas: number;
}

export interface FunnelData {
  estagio: string;
  total: number;
  valor: number;
}

export interface ChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface AuthUser extends User {
  token: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}
