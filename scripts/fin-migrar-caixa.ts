// Copia o Caixa antigo (financeiro_*) para o Financeiro novo (fin_*). Ver src/lib/fin/legacy/caixa.ts.
//
//   npm run fin:migrar-caixa              → simula (executa e desfaz) e mostra o relatório
//   npm run fin:migrar-caixa -- --aplicar → grava
//
// Banco: DATABASE_URL do ambiente, ou do .env.local (local). Gravar num banco que não seja
// localhost exige --confirmar-host=<host>, para nunca atingir a produção por engano
// (o prisma/.env aponta para o Supabase de produção).

const apply = process.argv.includes("--aplicar");
const confirmedHost = process.argv.find((a) => a.startsWith("--confirmar-host="))?.split("=")[1];

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(URL inválida)";
  }
}

function databaseOf(url: string): string {
  try {
    return new URL(url).pathname.slice(1) || "?";
  } catch {
    return "?";
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não definida. Rode via `npm run fin:migrar-caixa` (lê o .env.local).");
    process.exit(1);
  }
  const host = hostOf(url);
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  console.log(
    `Banco: ${databaseOf(url)} em ${host}${local ? " (local)" : ""} · modo: ${apply ? "GRAVAR" : "simulação"}\n`,
  );
  if (apply && !local && confirmedHost !== host) {
    console.error(`Banco remoto. Para gravar nele, repita com --confirmar-host=${host}`);
    process.exit(1);
  }

  // O .env.local traz NODE_ENV=development, que liga o log de cada consulta em src/lib/prisma.ts.
  if (process.env.NODE_ENV === "development") Object.assign(process.env, { NODE_ENV: "test" });

  // Import tardio: o Prisma só é carregado depois da checagem do banco.
  const { migrateCaixa } = await import("../src/fin/legacy/caixa");
  const { default: prisma } = await import("../src/lib/prisma");
  try {
    const r = await migrateCaixa({ apply });
    const line = (label: string, c: object) =>
      console.log(`${label.padEnd(13)} ${Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(" · ")}`);
    line("Contas", r.accounts);
    line("Categorias", r.categories);
    line("Lançamentos", r.transactions);
    console.log("\nSaldos (Caixa antigo → Financeiro novo):");
    for (const b of r.balances) {
      console.log(`  ${b.ok ? "ok " : "DIFERENTE"} ${b.account}: R$ ${b.legacy} → R$ ${b.migrated}`);
    }
    console.log(
      `\nCombustível dos carros: ${r.fuel.linked} de ${r.fuel.usesWithFuel} usos com gasolina têm a despesa no Financeiro novo` +
        (r.fuel.amountMismatch ? ` · ${r.fuel.amountMismatch} com valor diferente!` : ""),
    );
    if (r.warnings.length) {
      console.log("\nAvisos:");
      for (const w of r.warnings) console.log(`  - ${w}`);
    }
    console.log(apply ? "\nGravado." : "\nSimulação: nada foi gravado. Use --aplicar para gravar.");
    const allOk = r.balances.every((b) => b.ok) && r.fuel.linked === r.fuel.usesWithFuel && !r.fuel.amountMismatch;
    process.exitCode = allOk ? 0 : 2;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
