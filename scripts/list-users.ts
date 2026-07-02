import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, nome: true, email: true, role: true, ativo: true, deletedAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("Todos os usuários no banco:");
  console.table(users.map((u) => ({ email: u.email, nome: u.nome, role: u.role, ativo: u.ativo, deletado: !!u.deletedAt })));
  const clientes = await prisma.cliente.count({ where: { deletedAt: null } });
  console.log(`\nTotal de clientes no banco: ${clientes}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
