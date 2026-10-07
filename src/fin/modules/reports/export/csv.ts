import type { ReportCell, ReportResult } from "../types";

/**
 * Texto que começa com = + - @ (ou tab/CR) vira fórmula no Excel: prefixa com apóstrofo.
 * Números reais nunca passam por aqui (são escritos como número), então "R$ −5" não é afetado.
 */
export function neutralizeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function csvField(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function raw(cell: ReportCell): string {
  if (cell === null) return "";
  if (typeof cell === "string") return csvField(neutralizeFormula(cell));
  if ("money" in cell) return cell.money.replace(".", ","); // padrão brasileiro: vírgula decimal
  if ("percent" in cell)
    return cell.percent === null ? "" : (Number(cell.percent) * 100).toFixed(2).replace(".", ",");
  return String(cell.int);
}

/** CSV para Excel brasileiro: separador ";", decimal ",", UTF-8 com BOM. */
export function toCsv(report: ReportResult): string {
  const lines = [report.head.map((h) => csvField(neutralizeFormula(h))).join(";")];
  for (const row of report.rows) lines.push(row.map(raw).join(";"));
  if (report.totals) lines.push(report.totals.map(raw).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
