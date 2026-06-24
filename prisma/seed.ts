import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...");

  const senhaHash = await bcrypt.hash("123456", 12);

  // Único usuário: Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@crm.com" },
    update: {},
    create: {
      nome: "Administrador",
      email: "admin@crm.com",
      senha: senhaHash,
      role: "ADMINISTRADOR",
    },
  });

  // Remover outros usuários de seeds anteriores (se existirem)
  await prisma.user.updateMany({
    where: { email: { in: ["gestor@crm.com", "ana@crm.com", "pedro@crm.com"] } },
    data: { deletedAt: new Date() },
  });

  console.log("✅ Usuário admin criado");

  // Empresas
  const empresa1 = await prisma.empresa.upsert({
    where: { cnpj: "12.345.678/0001-00" },
    update: {},
    create: {
      razaoSocial: "Construtora Alpha Ltda",
      nomeFantasia: "Alpha Construções",
      cnpj: "12.345.678/0001-00",
      segmento: "Construção Civil",
      porte: "GRANDE",
      website: "https://alpha.com.br",
      telefone: "(11) 3456-7890",
      email: "contato@alpha.com.br",
      cep: "01310-100",
      logradouro: "Av. Paulista",
      numero: "1000",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      estado: "SP",
    },
  });

  const empresa2 = await prisma.empresa.upsert({
    where: { cnpj: "98.765.432/0001-00" },
    update: {},
    create: {
      razaoSocial: "TechStart Soluções Digitais",
      nomeFantasia: "TechStart",
      cnpj: "98.765.432/0001-00",
      segmento: "Tecnologia",
      porte: "MEDIO",
      website: "https://techstart.com.br",
      telefone: "(11) 9876-5432",
      email: "hello@techstart.com.br",
      cidade: "São Paulo",
      estado: "SP",
    },
  });

  console.log("✅ Empresas criadas");

  // Contatos
  const contato1 = await prisma.contato.create({
    data: {
      nome: "João Silva",
      cargo: "Diretor Comercial",
      email: "joao@alpha.com.br",
      telefone: "(11) 98765-4321",
      whatsapp: "(11) 98765-4321",
      principal: true,
      empresaId: empresa1.id,
    },
  });

  await prisma.contato.create({
    data: {
      nome: "Maria Oliveira",
      cargo: "Engenheira de Projetos",
      email: "maria@alpha.com.br",
      telefone: "(11) 97654-3210",
      empresaId: empresa1.id,
    },
  });

  const contato3 = await prisma.contato.create({
    data: {
      nome: "Paulo Tech",
      cargo: "CTO",
      email: "paulo@techstart.com.br",
      whatsapp: "(11) 91234-5678",
      principal: true,
      empresaId: empresa2.id,
    },
  });

  console.log("✅ Contatos criados");

  // Clientes
  const cliente1 = await prisma.cliente.create({
    data: {
      nome: "João Silva",
      razaoSocial: "Construtora Alpha Ltda",
      cpfCnpj: "12.345.678/0001-00",
      email: "joao@alpha.com.br",
      telefone: "(11) 3456-7890",
      whatsapp: "(11) 98765-4321",
      cep: "01310-100",
      logradouro: "Av. Paulista",
      numero: "1000",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      estado: "SP",
      segmento: "Construção Civil",
      porte: "GRANDE",
      origem: "INDICACAO",
      responsavelId: admin.id,
      empresaId: empresa1.id,
      contatoId: contato1.id,
      observacoes: "Cliente VIP, prefere contato por WhatsApp",
    },
  });

  const cliente2 = await prisma.cliente.create({
    data: {
      nome: "Maria Tech",
      email: "maria@techstart.com.br",
      telefone: "(11) 9876-5432",
      segmento: "Tecnologia",
      porte: "MEDIO",
      origem: "SITE",
      responsavelId: admin.id,
      empresaId: empresa2.id,
      contatoId: contato3.id,
    },
  });

  const cliente3 = await prisma.cliente.create({
    data: {
      nome: "Roberto Fernandes",
      cpfCnpj: "123.456.789-00",
      email: "roberto@email.com",
      telefone: "(21) 99876-5432",
      cidade: "Rio de Janeiro",
      estado: "RJ",
      segmento: "Varejo",
      porte: "PEQUENO",
      origem: "GOOGLE_ADS",
      responsavelId: admin.id,
    },
  });

  console.log("✅ Clientes criados");

  // Leads
  const lead1 = await prisma.lead.create({
    data: {
      titulo: "Sistema ERP para Construtora Alpha",
      descricao: "Interesse em sistema completo de gestão",
      estagio: "PROPOSTA_ENVIADA",
      valorEstimado: 85000,
      temperatura: "QUENTE",
      origem: "INDICACAO",
      responsavelId: admin.id,
      clienteId: cliente1.id,
      empresaId: empresa1.id,
      contatoId: contato1.id,
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      titulo: "Desenvolvimento App Mobile TechStart",
      estagio: "QUALIFICACAO",
      valorEstimado: 45000,
      temperatura: "MORNO",
      origem: "SITE",
      responsavelId: admin.id,
      clienteId: cliente2.id,
      empresaId: empresa2.id,
    },
  });

  await prisma.lead.create({
    data: {
      titulo: "Consultoria em Marketing Digital",
      estagio: "NOVO_LEAD",
      valorEstimado: 12000,
      temperatura: "FRIO",
      origem: "GOOGLE_ADS",
      responsavelId: admin.id,
      clienteId: cliente3.id,
    },
  });

  await prisma.lead.create({
    data: {
      titulo: "Automação de Processos - Construtora",
      estagio: "NEGOCIACAO",
      valorEstimado: 65000,
      temperatura: "QUENTE",
      origem: "INDICACAO",
      responsavelId: admin.id,
    },
  });

  const lead5 = await prisma.lead.create({
    data: {
      titulo: "Treinamento Equipe Comercial",
      estagio: "FECHADO_GANHO",
      valorEstimado: 18000,
      temperatura: "QUENTE",
      origem: "PARCEIRO",
      responsavelId: admin.id,
      dataFechamento: new Date(),
    },
  });

  console.log("✅ Leads criados");

  // Oportunidades
  const opo1 = await prisma.oportunidade.create({
    data: {
      titulo: "Implementação ERP Completo - Alpha",
      descricao: "Implementação completa com módulos financeiro e comercial",
      valor: 85000,
      probabilidade: 75,
      status: "ABERTA",
      dataPrevisao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      responsavelId: admin.id,
      clienteId: cliente1.id,
      empresaId: empresa1.id,
      leadId: lead1.id,
    },
  });

  await prisma.oportunidade.create({
    data: {
      titulo: "App Mobile TechStart",
      valor: 45000,
      probabilidade: 50,
      status: "ABERTA",
      dataPrevisao: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      responsavelId: admin.id,
      clienteId: cliente2.id,
      empresaId: empresa2.id,
    },
  });

  await prisma.oportunidade.create({
    data: {
      titulo: "Treinamento Comercial Q1",
      valor: 18000,
      probabilidade: 100,
      status: "GANHA",
      dataPrevisao: new Date(),
      dataFechamento: new Date(),
      responsavelId: admin.id,
      clienteId: cliente3.id,
      leadId: lead5.id,
    },
  });

  console.log("✅ Oportunidades criadas");

  // Tarefas
  await prisma.tarefa.createMany({
    data: [
      {
        titulo: "Apresentação proposta ERP",
        descricao: "Apresentar proposta completa para diretoria da Alpha",
        tipo: "REUNIAO",
        status: "PENDENTE",
        prioridade: "ALTA",
        dataVencimento: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        responsavelId: admin.id,
        clienteId: cliente1.id,
        leadId: lead1.id,
        oportunidadeId: opo1.id,
      },
      {
        titulo: "Follow-up TechStart",
        tipo: "FOLLOW_UP",
        status: "PENDENTE",
        prioridade: "MEDIA",
        dataVencimento: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        responsavelId: admin.id,
        clienteId: cliente2.id,
        leadId: lead2.id,
      },
      {
        titulo: "Ligação prospecção novos leads",
        tipo: "LIGACAO",
        status: "CONCLUIDA",
        prioridade: "MEDIA",
        dataVencimento: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        dataConclusao: new Date(Date.now() - 12 * 60 * 60 * 1000),
        responsavelId: admin.id,
      },
      {
        titulo: "Enviar contrato assinado",
        tipo: "EMAIL",
        status: "PENDENTE",
        prioridade: "ALTA",
        dataVencimento: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        responsavelId: admin.id,
        clienteId: cliente3.id,
      },
    ],
  });

  console.log("✅ Tarefas criadas");

  // Atividades
  await prisma.atividade.createMany({
    data: [
      { tipo: "CRIACAO", descricao: "Cliente João Silva criado", userId: admin.id, clienteId: cliente1.id },
      { tipo: "CRIACAO", descricao: 'Lead "Sistema ERP para Construtora Alpha" criado', userId: admin.id, leadId: lead1.id, clienteId: cliente1.id },
      { tipo: "ESTAGIO_ALTERADO", descricao: "Estágio alterado de NOVO_LEAD para PROPOSTA_ENVIADA", userId: admin.id, leadId: lead1.id, metadata: { de: "NOVO_LEAD", para: "PROPOSTA_ENVIADA" } },
    ],
  });

  // Comentários
  await prisma.comentario.create({
    data: { texto: "Cliente muito interessado no módulo financeiro. Reunião agendada para a próxima semana.", userId: admin.id, clienteId: cliente1.id },
  });

  // Notificações
  await prisma.notificacao.createMany({
    data: [
      { titulo: "Novo Lead criado", mensagem: 'O lead "Sistema ERP para Construtora Alpha" foi criado', tipo: "LEAD_NOVO", userId: admin.id, linkUrl: `/leads/${lead1.id}` },
      { titulo: "Tarefa vencendo", mensagem: "Apresentação proposta ERP vence em 2 dias", tipo: "TAREFA_VENCENDO", userId: admin.id },
    ],
  });

  // Audit Logs
  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id, entidade: "Cliente", entidadeId: cliente1.id, acao: "CREATE" },
      { userId: admin.id, entidade: "Lead", entidadeId: lead1.id, acao: "CREATE" },
    ],
  });

  console.log("✅ Seed concluído com sucesso!");
  console.log("\n📋 Credencial de acesso:");
  console.log("  Admin: admin@crm.com / 123456");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
