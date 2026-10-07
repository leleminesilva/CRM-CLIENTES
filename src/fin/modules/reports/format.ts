import { formatMonth, isMonthKey } from "@fin/lib/dates";
import { formatMoney, formatPercent } from "@fin/lib/money";
import type { ReportCell } from "./types";

/** Texto exibido na tela e no PDF. Chaves de mês viram "out/26". */
export function displayCell(cell: ReportCell): string {
  if (cell === null) return "—";
  if (typeof cell === "string") return isMonthKey(cell) ? formatMonth(cell, "short") : cell;
  if ("money" in cell) return formatMoney(cell.money);
  if ("percent" in cell) return cell.percent === null ? "—" : formatPercent(cell.percent, 1);
  return String(cell.int);
}

export const isNumericCell = (cell: ReportCell): boolean =>
  cell !== null && typeof cell === "object";
