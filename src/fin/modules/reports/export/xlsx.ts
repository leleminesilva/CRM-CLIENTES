import ExcelJS from "exceljs";
import { formatMonth, isMonthKey } from "@fin/lib/dates";
import { neutralizeFormula } from "./csv";
import type { ReportCell, ReportResult } from "../types";

function cellValue(cell: ReportCell): string | number | null {
  if (cell === null) return null;
  if (typeof cell === "string")
    return neutralizeFormula(isMonthKey(cell) ? formatMonth(cell, "short") : cell);
  if ("money" in cell) return Number(cell.money);
  if ("percent" in cell) return cell.percent === null ? null : Number(cell.percent);
  return cell.int;
}

const FORMAT = { money: '"R$" #,##0.00;[Red]-"R$" #,##0.00', percent: "0.0%", int: "0" } as const;

/** XLSX com valores numéricos de verdade (somam, ordenam e formatam no Excel). */
export async function toXlsx(report: ReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Controle de Gasto";
  const ws = wb.addWorksheet(report.title.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
  ws.addRow(report.head).font = { bold: true };
  const write = (row: ReportCell[], bold = false) => {
    const r = ws.addRow(row.map(cellValue));
    if (bold) r.font = { bold: true };
    row.forEach((cell, i) => {
      if (cell && typeof cell === "object")
        r.getCell(i + 1).numFmt =
          "money" in cell ? FORMAT.money : "percent" in cell ? FORMAT.percent : FORMAT.int;
    });
  };
  for (const row of report.rows) write(row);
  if (report.totals) write(report.totals, true);
  ws.columns.forEach((col, i) => {
    col.width = i === 0 ? 28 : 18;
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
