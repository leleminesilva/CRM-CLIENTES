import { PrismaClient } from "@prisma/client";
import { CATALOGO_ALUMY } from "./seedData/catalogoAlumy";

// Script separado do seed.ts principal (que é dado de demonstração, não
// idempotente, não deve rodar contra produção). Este aqui só cria a
// estrutura de catálogo (linhas + produtos, preço zerado, sem variantes) via
// upsert — seguro de rodar mais de uma vez, inclusive contra o banco real.
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Semeando estrutura de catálogo (Orçamentos Técnicos)...");

  for (let index = 0; index < CATALOGO_ALUMY.length; index++) {
    const linha = CATALOGO_ALUMY[index];
    const linhaCriada = await prisma.linhaProduto.upsert({
      where: { nome: linha.nome },
      update: {},
      create: { nome: linha.nome, ordem: index },
    });

    const produtos = linha.produtos ?? [];
    for (let pIndex = 0; pIndex < produtos.length; pIndex++) {
      const produto = produtos[pIndex];
      await prisma.produtoCatalogo.upsert({
        where: { linhaId_nome: { linhaId: linhaCriada.id, nome: produto.nome } },
        update: {},
        create: {
          linhaId: linhaCriada.id,
          nome: produto.nome,
          modoCalculo: produto.modoCalculo,
          ordem: pIndex,
        },
      });
    }

    console.log(`  ✓ ${linha.nome} (${produtos.length} produto(s))`);
  }

  console.log(`✅ ${CATALOGO_ALUMY.length} linhas de produto semeadas.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
