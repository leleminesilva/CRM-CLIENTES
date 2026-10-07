import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { displayCell, isNumericCell } from "../format";
import type { ReportResult } from "../types";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#111915", fontFamily: "Helvetica" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  sub: { marginTop: 3, marginBottom: 14, color: "#4b5651" },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dee3de",
    paddingVertical: 4,
  },
  head: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111915",
    paddingVertical: 4,
    fontFamily: "Helvetica-Bold",
  },
  total: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#111915",
    paddingVertical: 5,
    fontFamily: "Helvetica-Bold",
  },
  foot: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    color: "#646f69",
    fontSize: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

/** A fonte padrão do PDF não tem o sinal de menos tipográfico: usa o hífen. */
const safe = (text: string) => text.replace(/−/g, "-").replace(/ /g, " ");

export async function toPdf(
  report: ReportResult,
  meta: { workspace: string; generatedAt: string; filtersText: string },
): Promise<Buffer> {
  const cols = report.head.length;
  const widths = report.head.map((_, i) => (i === 0 ? 2 : 1.3));
  const cell = (text: string, i: number, numeric: boolean) => (
    <Text
      key={i}
      style={{ flex: widths[i], textAlign: numeric ? "right" : "left", paddingHorizontal: 3 }}
    >
      {safe(text)}
    </Text>
  );
  const doc = (
    <Document title={report.title} author="Controle de Gasto">
      <Page size="A4" orientation={cols > 5 ? "landscape" : "portrait"} style={styles.page} wrap>
        <Text style={styles.title}>{report.title}</Text>
        <Text style={styles.sub}>
          {meta.workspace} · {meta.filtersText}
        </Text>
        <View style={styles.head} fixed>
          {report.head.map((h, i) => cell(h, i, i > 0))}
        </View>
        {report.rows.map((row, r) => (
          <View key={r} style={styles.row} wrap={false}>
            {row.map((c, i) => cell(displayCell(c), i, isNumericCell(c)))}
          </View>
        ))}
        {report.totals ? (
          <View style={styles.total} wrap={false}>
            {report.totals.map((c, i) => cell(displayCell(c), i, isNumericCell(c)))}
          </View>
        ) : null}
        {report.note ? (
          <Text style={{ marginTop: 10, color: "#4b5651" }}>{safe(report.note)}</Text>
        ) : null}
        <View style={styles.foot} fixed>
          <Text>Gerado em {safe(meta.generatedAt)}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return Buffer.from(await renderToBuffer(doc));
}
