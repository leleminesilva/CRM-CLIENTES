-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMINISTRADOR', 'GESTOR', 'COMERCIAL', 'OPERACIONAL');

-- CreateEnum
CREATE TYPE "Porte" AS ENUM ('MICRO', 'PEQUENO', 'MEDIO', 'GRANDE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "OrigemCliente" AS ENUM ('INDICACAO', 'SITE', 'REDES_SOCIAIS', 'GOOGLE_ADS', 'EVENTO', 'LIGACAO_ATIVA', 'PARCEIRO', 'OUTROS');

-- CreateEnum
CREATE TYPE "EstagioLead" AS ENUM ('NOVO_LEAD', 'CONTATO_INICIAL', 'QUALIFICACAO', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'FECHADO_GANHO', 'FECHADO_PERDIDO');

-- CreateEnum
CREATE TYPE "Temperatura" AS ENUM ('QUENTE', 'MORNO', 'FRIO');

-- CreateEnum
CREATE TYPE "StatusOportunidade" AS ENUM ('ABERTA', 'GANHA', 'PERDIDA', 'SUSPENSA');

-- CreateEnum
CREATE TYPE "TipoTarefa" AS ENUM ('REUNIAO', 'LIGACAO', 'VISITA', 'FOLLOW_UP', 'EMAIL', 'TAREFA');

-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA', 'ATRASADA');

-- CreateEnum
CREATE TYPE "Prioridade" AS ENUM ('ALTA', 'MEDIA', 'BAIXA');

-- CreateEnum
CREATE TYPE "TipoAtividade" AS ENUM ('CRIACAO', 'EDICAO', 'ESTAGIO_ALTERADO', 'COMENTARIO', 'TAREFA_CRIADA', 'TAREFA_CONCLUIDA', 'LIGACAO', 'EMAIL', 'REUNIAO', 'ANEXO_ADICIONADO');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('LEAD_NOVO', 'TAREFA_VENCENDO', 'OPORTUNIDADE_PARADA', 'CLIENTE_SEM_CONTATO', 'SISTEMA');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'COMERCIAL',
    "avatar" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT,
    "segmento" TEXT,
    "porte" "Porte" NOT NULL DEFAULT 'PEQUENO',
    "website" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "observacoes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "cpf" TEXT,
    "avatar" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "empresaId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "cpfCnpj" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "segmento" TEXT,
    "porte" "Porte",
    "origem" "OrigemCliente" NOT NULL DEFAULT 'OUTROS',
    "responsavelId" TEXT,
    "empresaId" TEXT,
    "contatoId" TEXT,
    "observacoes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "estagio" "EstagioLead" NOT NULL DEFAULT 'NOVO_LEAD',
    "ordemKanban" INTEGER NOT NULL DEFAULT 0,
    "valorEstimado" DECIMAL(15,2),
    "temperatura" "Temperatura" NOT NULL DEFAULT 'MORNO',
    "origem" "OrigemCliente" NOT NULL DEFAULT 'OUTROS',
    "responsavelId" TEXT,
    "clienteId" TEXT,
    "empresaId" TEXT,
    "contatoId" TEXT,
    "dataFechamento" TIMESTAMP(3),
    "motivoPerda" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oportunidades" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(15,2) NOT NULL,
    "probabilidade" INTEGER NOT NULL DEFAULT 50,
    "status" "StatusOportunidade" NOT NULL DEFAULT 'ABERTA',
    "dataPrevisao" TIMESTAMP(3),
    "dataFechamento" TIMESTAMP(3),
    "responsavelId" TEXT,
    "clienteId" TEXT,
    "empresaId" TEXT,
    "contatoId" TEXT,
    "leadId" TEXT,
    "motivoPerda" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oportunidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoTarefa" NOT NULL DEFAULT 'TAREFA',
    "status" "StatusTarefa" NOT NULL DEFAULT 'PENDENTE',
    "prioridade" "Prioridade" NOT NULL DEFAULT 'MEDIA',
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "dataInicio" TIMESTAMP(3),
    "dataConclusao" TIMESTAMP(3),
    "responsavelId" TEXT,
    "clienteId" TEXT,
    "leadId" TEXT,
    "oportunidadeId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividades" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAtividade" NOT NULL,
    "descricao" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clienteId" TEXT,
    "leadId" TEXT,
    "oportunidadeId" TEXT,
    "contatoId" TEXT,
    "empresaId" TEXT,
    "tarefaId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentarios" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clienteId" TEXT,
    "leadId" TEXT,
    "oportunidadeId" TEXT,
    "contatoId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "clienteId" TEXT,
    "leadId" TEXT,
    "oportunidadeId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "linkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "dadosAntigos" JSONB,
    "dadosNovos" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- AddForeignKey
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oportunidades" ADD CONSTRAINT "oportunidades_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_tarefaId_fkey" FOREIGN KEY ("tarefaId") REFERENCES "tarefas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "oportunidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
