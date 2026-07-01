// Categorías de gastos del gimnasio. Compartido entre Server Action y UI.

export const EXPENSE_CATEGORIES = [
  "arriendo",
  "sueldos",
  "servicios",
  "mantenimiento",
  "insumos",
  "marketing",
  "otros",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  arriendo: "Arriendo",
  sueldos: "Sueldos",
  servicios: "Servicios (luz, agua, internet)",
  mantenimiento: "Mantenimiento",
  insumos: "Insumos",
  marketing: "Marketing",
  otros: "Otros",
};

export function isExpenseCategory(v: string): v is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(v);
}
