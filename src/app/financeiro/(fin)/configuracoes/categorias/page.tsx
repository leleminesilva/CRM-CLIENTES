import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { CategoriesView } from "@fin/modules/categories/components/categories-view";
import { getCategoryTree } from "@fin/modules/categories/queries";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ arquivadas?: string }>;
}) {
  const ctx = await requirePageContext();
  const showArchived = (await searchParams).arquivadas === "1";
  const [expense, income] = await Promise.all([
    getCategoryTree(ctx, { kind: "EXPENSE", includeArchived: showArchived }),
    getCategoryTree(ctx, { kind: "INCOME", includeArchived: showArchived }),
  ]);
  return <CategoriesView expense={expense} income={income} showArchived={showArchived} />;
}
