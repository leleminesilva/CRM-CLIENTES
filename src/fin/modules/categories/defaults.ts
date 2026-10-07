import type { ExpenseNature, IncomeClass } from "@prisma/client";
import type { DbClient } from "@fin/lib/db";
import type { CategoryIconName } from "./icons";

interface CategoryTemplate {
  name: string;
  icon: CategoryIconName;
  color: string;
  incomeClass?: IncomeClass;
  defaultNature?: ExpenseNature;
  isEssential?: boolean;
  systemKey?: string;
  children?: Omit<CategoryTemplate, "children" | "color">[];
}

const blue = "#2a78d6";
const orange = "#eb6834";
const aqua = "#1baf7a";
const yellow = "#eda100";
const pink = "#e87ba4";
const green = "#008300";
const violet = "#4a3aa7";
const red = "#e34948";
const teal = "#0e8a96";
const slate = "#6b7a73";

/** Árvore inicial de despesas (docs/03-banco-de-dados.md §10). */
export const DEFAULT_EXPENSE_CATEGORIES: CategoryTemplate[] = [
  {
    name: "Moradia",
    icon: "house",
    color: blue,
    isEssential: true,
    defaultNature: "FIXED",
    children: [
      { name: "Aluguel", icon: "key-round", isEssential: true, defaultNature: "FIXED" },
      { name: "Condomínio", icon: "building-2", isEssential: true, defaultNature: "FIXED" },
      { name: "Energia", icon: "zap", isEssential: true, defaultNature: "FIXED" },
      { name: "Água", icon: "droplet", isEssential: true, defaultNature: "FIXED" },
      { name: "Internet", icon: "wifi", isEssential: true, defaultNature: "FIXED" },
      { name: "Telefone", icon: "smartphone", isEssential: true, defaultNature: "FIXED" },
    ],
  },
  {
    name: "Alimentação",
    icon: "utensils",
    color: orange,
    isEssential: true,
    defaultNature: "VARIABLE",
    children: [
      { name: "Mercado", icon: "shopping-cart", isEssential: true, defaultNature: "VARIABLE" },
      { name: "Restaurante", icon: "utensils-crossed", defaultNature: "VARIABLE" },
    ],
  },
  {
    name: "Transporte",
    icon: "car",
    color: yellow,
    isEssential: true,
    defaultNature: "VARIABLE",
    children: [
      { name: "Combustível", icon: "fuel", isEssential: true, defaultNature: "VARIABLE" },
      { name: "Veículo", icon: "car-front", isEssential: true, defaultNature: "VARIABLE" },
    ],
  },
  { name: "Seguro", icon: "shield-check", color: slate, isEssential: true, defaultNature: "FIXED" },
  {
    name: "Saúde",
    icon: "heart-pulse",
    color: red,
    isEssential: true,
    defaultNature: "VARIABLE",
    children: [
      { name: "Academia", icon: "dumbbell", defaultNature: "FIXED" },
      { name: "Jiu-Jitsu", icon: "medal", defaultNature: "FIXED" },
    ],
  },
  { name: "Assinaturas", icon: "repeat", color: violet, defaultNature: "FIXED" },
  {
    name: "Trabalho",
    icon: "briefcase",
    color: teal,
    defaultNature: "VARIABLE",
    children: [
      { name: "Equipamentos", icon: "camera", defaultNature: "VARIABLE" },
      { name: "Audiovisual", icon: "clapperboard", defaultNature: "VARIABLE" },
      { name: "Empresa", icon: "building", defaultNature: "VARIABLE" },
    ],
  },
  { name: "Lazer", icon: "ticket", color: pink, defaultNature: "VARIABLE" },
  { name: "Viagens", icon: "plane", color: aqua, defaultNature: "VARIABLE" },
  { name: "Educação", icon: "graduation-cap", color: green, defaultNature: "VARIABLE" },
  { name: "Impostos", icon: "landmark", color: slate, defaultNature: "FIXED" },
  { name: "Outros", icon: "ellipsis", color: slate, defaultNature: "VARIABLE" },
  {
    name: "Encargos do cartão",
    icon: "percent",
    color: red,
    defaultNature: "VARIABLE",
    systemKey: "card_fees",
  },
];

/** Receitas: a classe alimenta o painel (Base · Comissões · Renda extra · Outros). */
export const DEFAULT_INCOME_CATEGORIES: CategoryTemplate[] = [
  { name: "Salário/base", icon: "wallet", color: green, incomeClass: "BASE" },
  {
    name: "Comissões",
    icon: "badge-percent",
    color: blue,
    incomeClass: "COMMISSION",
    systemKey: "commission",
  },
  { name: "Freelancer", icon: "laptop", color: teal, incomeClass: "EXTRA" },
  { name: "Renda extra", icon: "sparkles", color: aqua, incomeClass: "EXTRA" },
  { name: "Reembolso", icon: "undo-2", color: slate, incomeClass: "OTHER" },
  { name: "Rendimentos", icon: "trending-up", color: green, incomeClass: "OTHER" },
  { name: "13º e férias", icon: "gift", color: pink, incomeClass: "OTHER" },
  { name: "Outros", icon: "ellipsis", color: slate, incomeClass: "OTHER" },
];

/** Cria a árvore padrão num workspace recém-criado. */
export async function createDefaultCategories(db: DbClient, workspaceId: string): Promise<void> {
  const groups = [
    { kind: "EXPENSE" as const, items: DEFAULT_EXPENSE_CATEGORIES },
    { kind: "INCOME" as const, items: DEFAULT_INCOME_CATEGORIES },
  ];
  for (const { kind, items } of groups) {
    for (const [index, item] of items.entries()) {
      const parent = await db.category.create({
        data: {
          workspaceId,
          kind,
          name: item.name,
          icon: item.icon,
          color: item.color,
          incomeClass: kind === "INCOME" ? (item.incomeClass ?? "OTHER") : null,
          defaultNature: kind === "EXPENSE" ? (item.defaultNature ?? null) : null,
          isEssential: item.isEssential ?? false,
          systemKey: item.systemKey ?? null,
          sortOrder: index,
        },
      });
      if (item.children?.length) {
        await db.category.createMany({
          data: item.children.map((child, childIndex) => ({
            workspaceId,
            kind,
            parentId: parent.id,
            name: child.name,
            icon: child.icon,
            color: item.color,
            incomeClass:
              kind === "INCOME" ? (child.incomeClass ?? item.incomeClass ?? "OTHER") : null,
            defaultNature: kind === "EXPENSE" ? (child.defaultNature ?? null) : null,
            isEssential: child.isEssential ?? false,
            systemKey: child.systemKey ?? null,
            sortOrder: childIndex,
          })),
        });
      }
    }
  }
}
