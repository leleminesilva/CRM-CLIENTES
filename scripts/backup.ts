import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  const backupDir = `/Users/leandromedeiros/Desktop/Backup CRM - ${new Date().toISOString().slice(0, 10)}`;
  const dataDir = path.join(backupDir, "dados");
  fs.mkdirSync(dataDir, { recursive: true });

  console.log("🔄 Iniciando backup completo do banco de dados...\n");

  const tabelas = [
    { nome: "users",             query: () => prisma.user.findMany() },
    { nome: "empresas",          query: () => prisma.empresa.findMany() },
    { nome: "contatos",          query: () => prisma.contato.findMany() },
    { nome: "clientes",          query: () => prisma.cliente.findMany() },
    { nome: "leads",             query: () => prisma.lead.findMany() },
    { nome: "oportunidades",     query: () => prisma.oportunidade.findMany() },
    { nome: "tarefas",           query: () => prisma.tarefa.findMany() },
    { nome: "atividades",        query: () => prisma.atividade.findMany() },
    { nome: "comentarios",       query: () => prisma.comentario.findMany() },
    { nome: "anexos",            query: () => prisma.anexo.findMany() },
    { nome: "notificacoes",      query: () => prisma.notificacao.findMany() },
    { nome: "audit_logs",        query: () => prisma.auditLog.findMany() },
  ];

  let totalRegistros = 0;
  const resumo: Record<string, number> = {};

  for (const tabela of tabelas) {
    process.stdout.write(`  Exportando ${tabela.nome}...`);
    const dados = await tabela.query();
    const arquivo = path.join(dataDir, `${tabela.nome}.json`);
    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), "utf-8");
    resumo[tabela.nome] = dados.length;
    totalRegistros += dados.length;
    console.log(` ${dados.length} registros ✅`);
  }

  // Arquivo de resumo
  const resumoObj = {
    data: new Date().toISOString(),
    totalRegistros,
    tabelas: resumo,
    versao: "1.0",
  };
  fs.writeFileSync(
    path.join(backupDir, "resumo.json"),
    JSON.stringify(resumoObj, null, 2),
    "utf-8"
  );

  // README
  const readme = `# Backup CRM Infinity Glass
Data: ${new Date().toLocaleString("pt-BR")}
Total de registros: ${totalRegistros}

## Tabelas exportadas
${Object.entries(resumo).map(([t, n]) => `- ${t}: ${n} registros`).join("\n")}

## Como restaurar
Importe os arquivos JSON da pasta "dados/" usando o script de restore do projeto.
`;
  fs.writeFileSync(path.join(backupDir, "README.txt"), readme, "utf-8");

  console.log(`\n✅ Backup concluído!`);
  console.log(`📁 Local: ${backupDir}`);
  console.log(`📊 Total de registros: ${totalRegistros}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
