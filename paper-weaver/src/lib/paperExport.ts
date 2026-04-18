import { jsPDF } from "jspdf";

export interface ExportQuestion {
  text: string;
  marks: number;
  type?: string;
  topic?: string;
  chartType?: "line" | "bar" | "scatter" | "pie";
  chartMode?: "student_plot" | "analyze_graph";
  chartSpec?: string | Record<string, unknown> | null;
  options?: string[] | null;
  answer?: string | null;
}

export interface ExportSection {
  title: string;
  instructions?: string | null;
  questions: ExportQuestion[];
}

export interface ExportMeta {
  title: string;
  subject: string;
  durationMinutes: number;
  totalMarks: number;
  institution?: string;
  code?: string;
  semester?: string;
  examType?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const sanitizeFileName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "paper";

const parseChartSpec = (raw?: string | Record<string, unknown> | null) => {
  if (!raw) return null;
  const toSpec = (v: any) => {
    if (!v || typeof v !== "object") return null;
    const points = Array.isArray(v.points)
      ? v.points
          .map((p: any, idx: number) => {
            const y = Number(p?.y);
            if (!Number.isFinite(y)) return null;
            return {
              x: p?.x ?? idx + 1,
              y,
            };
          })
          .filter(Boolean)
      : [];
    if (!points.length) return null;
    return {
      chart_type: ["line", "bar", "scatter", "pie"].includes(String(v.chart_type)) ? v.chart_type : "line",
      title: String(v.title || "Generated Chart"),
      x_label: String(v.x_label || "X Axis"),
      y_label: String(v.y_label || "Y Axis"),
      points,
    };
  };

  if (typeof raw === "object") {
    return toSpec(raw);
  }

  try {
    return toSpec(JSON.parse(raw));
  } catch {
    return null;
  }
};

const formatAxisValue = (value: unknown): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  if (Math.abs(n) >= 1_000_000) return n.toExponential(1);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const toExportSafeText = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[–—]/g, "-")
    .replace(/[×]/g, "x")
    .replace(/[≤]/g, "<=")
    .replace(/[≥]/g, ">=")
    .replace(/[σΣ]/g, "sigma")
    .replace(/[ωΩ]/g, "omega")
    .replace(/[μ]/g, "mu")
    .replace(/[°]/g, " deg")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeOptionText = (value: string): string =>
  toExportSafeText(value)
    .replace(/^\s*\(?[A-Za-z0-9]+\)?\s*[\.:\)-]\s*/u, "")
    .trim();

const downloadBlob = (filename: string, mimeType: string, content: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const buildPaperText = (
  meta: ExportMeta,
  sections: ExportSection[],
  includeAnswers = false,
): string => {
  const lines: string[] = [];
  lines.push(toExportSafeText(meta.institution || ""));
  lines.push(toExportSafeText(meta.title));
  lines.push(toExportSafeText(`${meta.subject}${meta.code ? ` (${meta.code})` : ""}`));
  lines.push(
    toExportSafeText(`Duration: ${meta.durationMinutes} minutes | Total Marks: ${meta.totalMarks}${meta.semester ? ` | Semester: ${meta.semester}` : ""}`),
  );
  if (meta.examType) lines.push(toExportSafeText(`Exam Type: ${meta.examType}`));
  lines.push("");

  let qNo = 1;
  for (const section of sections) {
    lines.push(toExportSafeText(section.title));
    if (section.instructions) lines.push(toExportSafeText(section.instructions));
    lines.push("");
    for (const question of section.questions) {
      lines.push(`${qNo}. (${question.marks}m) ${toExportSafeText(question.text)}`);
      if (question.options?.length) {
        question.options.forEach((option, idx) => {
          lines.push(`   ${String.fromCharCode(65 + idx)}. ${normalizeOptionText(option)}`);
        });
      }
      if (includeAnswers && question.answer) {
        lines.push(`   Answer: ${toExportSafeText(question.answer)}`);
      }
      if (question.chartMode === "student_plot") {
        const chart = parseChartSpec(question.chartSpec);
        if (chart?.points?.length) {
          lines.push("   Plot graph using generated data points:");
          lines.push(`   ${chart.points.map((p: any) => `(${p.x}, ${p.y})`).join(", ")}`);
        }
      }
      if (question.chartMode === "analyze_graph") {
        lines.push("   [Generated graph is included with this question in visual exports]");
      }
      lines.push("");
      qNo += 1;
    }
    lines.push("");
  }
  return lines.join("\n");
};

export const buildPaperHtml = (
  meta: ExportMeta,
  sections: ExportSection[],
  includeAnswers = false,
): string => {
  let qNo = 1;
  const sectionBlocks = sections
    .map((section) => {
      const qBlocks = section.questions
        .map((question) => {
          const questionNo = qNo;
          qNo += 1;

          const options = question.options?.length
            ? `<ol class="options">${question.options
                .map((opt) => `<li>${escapeHtml(normalizeOptionText(opt))}</li>`)
                .join("")}</ol>`
            : "";

          const answer = includeAnswers && question.answer
            ? `<p class="answer"><strong>Answer:</strong> ${escapeHtml(question.answer)}</p>`
            : "";

          const chart = parseChartSpec(question.chartSpec);
          const hasPoints = Array.isArray(chart?.points) && chart.points.length > 0;
          const chartPointsTable = hasPoints
            ? `<table class="chart-table"><thead><tr><th>${escapeHtml(String(chart.x_label || "X Axis"))}</th><th>${escapeHtml(String(chart.y_label || "Y Axis"))}</th></tr></thead><tbody>${chart.points
                .slice(0, 12)
                .map((pt: any) => `<tr><td>${escapeHtml(String(pt?.x ?? ""))}</td><td>${escapeHtml(String(pt?.y ?? ""))}</td></tr>`)
                .join("")}</tbody></table>`
            : "";
          const chartSvg =
            (question.chartMode === "analyze_graph" && hasPoints)
            || (question.chartMode === "student_plot" && includeAnswers && hasPoints)
              ? buildChartSvg(chart, question.chartType || chart.chart_type || "line")
              : "";
          const chartBlock = question.chartMode
            ? `<div class="chart-block">${
                question.chartMode === "student_plot"
                  ? includeAnswers
                    ? `<p class="chart-note"><strong>Reference graph:</strong> Generated from the same data points for teacher checking.</p>${chartSvg}${chartPointsTable}`
                    : `<p class="chart-note"><strong>Task:</strong> Plot the graph using the data below.</p>${chartPointsTable}`
                  : `<p class="chart-note"><strong>Task:</strong> Analyze the generated graph below.</p>${chartSvg}`
              }</div>`
            : "";

          return `
            <li class="question-item">
              <p><strong>${questionNo}.</strong> (${question.marks}m) ${escapeHtml(question.text)}</p>
              ${options}
              ${chartBlock}
              ${answer}
            </li>
          `;
        })
        .join("");

      return `
        <section class="section-block">
          <h2>${escapeHtml(section.title)}</h2>
          ${section.instructions ? `<p class="section-note">${escapeHtml(section.instructions)}</p>` : ""}
          <ol class="question-list">${qBlocks}</ol>
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(meta.title)}</title>
    <style>
      body { font-family: Georgia, serif; max-width: 900px; margin: 24px auto; padding: 0 18px; color: #111827; }
      .header { text-align: center; border-bottom: 1px solid #d1d5db; padding-bottom: 14px; margin-bottom: 22px; }
      .meta { color: #4b5563; font-size: 14px; margin-top: 6px; }
      .section-block { margin-top: 20px; }
      .section-note { color: #4b5563; font-style: italic; margin: 2px 0 10px; }
      .question-list { padding-left: 20px; }
      .question-item { margin-bottom: 12px; }
      .options { margin-top: 6px; }
      .answer { color: #1f2937; margin-top: 6px; }
      .chart-block { margin-top: 10px; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; background: #f9fafb; }
      .chart-note { margin: 0 0 8px 0; color: #374151; }
      .chart-svg-wrap { overflow-x: auto; }
      .chart-table { border-collapse: collapse; font-size: 12px; margin-top: 8px; }
      .chart-table th, .chart-table td { border: 1px solid #d1d5db; padding: 4px 8px; }
      @media print { body { margin: 0; max-width: none; } }
    </style>
  </head>
  <body>
    <header class="header">
      <div>${escapeHtml(meta.institution || "")}</div>
      <h1>${escapeHtml(meta.title)}</h1>
      <p class="meta">${escapeHtml(meta.subject)}${meta.code ? ` (${escapeHtml(meta.code)})` : ""}</p>
      <p class="meta">Duration: ${meta.durationMinutes} minutes | Total Marks: ${meta.totalMarks}${meta.semester ? ` | Semester: ${escapeHtml(meta.semester)}` : ""}</p>
      ${meta.examType ? `<p class="meta">Exam Type: ${escapeHtml(meta.examType)}</p>` : ""}
    </header>
    ${sectionBlocks}
  </body>
</html>`;
};

const buildChartSvg = (chart: any, chartType: string): string => {
  const points = Array.isArray(chart?.points) ? chart.points.slice(0, 20) : [];
  if (!points.length) return "";

  const width = 520;
  const height = 260;
  const pad = 36;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;

  const ys = points.map((p: any) => Number(p?.y ?? 0));
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const denom = maxY - minY || 1;
  const xLabel = String(chart?.x_label || "X");
  const yLabel = String(chart?.y_label || "Y");
  const xMin = points[0]?.x;
  const xMax = points[points.length - 1]?.x;

  const xy = points.map((p: any, i: number) => {
    const x = pad + (i / Math.max(points.length - 1, 1)) * plotW;
    const y = pad + plotH - ((Number(p?.y ?? 0) - minY) / denom) * plotH;
    return { x, y };
  });

  const axis = `<line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="#6b7280" />
<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="#6b7280" />`;

  let body = "";
  if (chartType === "bar") {
    const barW = plotW / points.length * 0.7;
    body = xy
      .map((p, i) => {
        const x = p.x - barW / 2;
        const h = height - pad - p.y;
        return `<rect x="${x}" y="${p.y}" width="${barW}" height="${h}" fill="#3b82f6" opacity="0.8" />`;
      })
      .join("");
  } else if (chartType === "scatter") {
    body = xy.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#2563eb" />`).join("");
  } else if (chartType === "pie") {
    const total = ys.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(plotW, plotH) / 2;
    let angle = -Math.PI / 2;
    const colors = ["#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
    body = ys
      .map((v, i) => {
        const frac = Math.max(0, v) / total;
        const next = angle + frac * Math.PI * 2;
        const x1 = cx + r * Math.cos(angle);
        const y1 = cy + r * Math.sin(angle);
        const x2 = cx + r * Math.cos(next);
        const y2 = cy + r * Math.sin(next);
        const large = frac > 0.5 ? 1 : 0;
        const path = `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}" opacity="0.85" />`;
        angle = next;
        return path;
      })
      .join("");
  } else {
    body = `<polyline points="${xy.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="#2563eb" stroke-width="2" />` +
      xy.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#2563eb" />`).join("");
  }

  const labels = chartType === "pie" ? "" : `
<text x="${width / 2}" y="${height - 6}" text-anchor="middle" font-size="11" fill="#4b5563">${escapeHtml(xLabel)}</text>
<text x="10" y="${height / 2}" text-anchor="middle" font-size="11" fill="#4b5563" transform="rotate(-90 10 ${height / 2})">${escapeHtml(yLabel)}</text>
<text x="${pad}" y="${height - pad + 14}" text-anchor="middle" font-size="10" fill="#6b7280">${escapeHtml(formatAxisValue(xMin))}</text>
<text x="${width - pad}" y="${height - pad + 14}" text-anchor="middle" font-size="10" fill="#6b7280">${escapeHtml(formatAxisValue(xMax))}</text>
<text x="${pad - 8}" y="${pad + 4}" text-anchor="end" font-size="10" fill="#6b7280">${escapeHtml(formatAxisValue(maxY))}</text>
<text x="${pad - 8}" y="${height - pad + 4}" text-anchor="end" font-size="10" fill="#6b7280">${escapeHtml(formatAxisValue(minY))}</text>`;

  return `<div class="chart-svg-wrap"><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="generated chart">${axis}${body}${labels}</svg></div>`;
};

export const buildPaperLatex = (
  meta: ExportMeta,
  sections: ExportSection[],
  includeAnswers = false,
): string => {
  const esc = (v: string) =>
    v
      .replaceAll("\\", "\\textbackslash{}")
      .replaceAll("&", "\\&")
      .replaceAll("%", "\\%")
      .replaceAll("$", "\\$")
      .replaceAll("#", "\\#")
      .replaceAll("_", "\\_")
      .replaceAll("{", "\\{")
      .replaceAll("}", "\\}");

  const lines: string[] = [
    "\\documentclass[12pt]{article}",
    "\\usepackage[margin=1in]{geometry}",
    "\\usepackage{enumitem}",
    "\\begin{document}",
    "\\begin{center}",
    `\\textbf{${esc(meta.institution || "")}}\\\\`,
    `\\Large\\textbf{${esc(meta.title)}}\\\\`,
    `${esc(meta.subject)}${meta.code ? ` (${esc(meta.code)})` : ""}\\\\`,
    `Duration: ${meta.durationMinutes} minutes \quad Total Marks: ${meta.totalMarks}${meta.semester ? ` \quad Semester: ${esc(meta.semester)}` : ""}`,
    "\\end{center}",
    "\\vspace{0.5cm}",
    "\\begin{enumerate}[leftmargin=*,label=\\arabic*.]",
  ];

  for (const section of sections) {
    lines.push(`\\item[] \\textbf{${esc(section.title)}}`);
    if (section.instructions) lines.push(`\\item[] \\textit{${esc(section.instructions)}}`);
    for (const question of section.questions) {
      lines.push(`\\item (${question.marks}m) ${esc(question.text)}`);
      if (question.options?.length) {
        lines.push("\\begin{enumerate}[label=\\Alph*.]");
        question.options.forEach((option) => lines.push(`\\item ${esc(normalizeOptionText(option))}`));
        lines.push("\\end{enumerate}");
      }
      if (includeAnswers && question.answer) {
        lines.push(`\\textit{Answer: ${esc(question.answer)}}`);
      }
    }
  }

  lines.push("\\end{enumerate}");
  lines.push("\\end{document}");
  return lines.join("\n");
};

export const exportPaperAsTxt = (meta: ExportMeta, sections: ExportSection[], includeAnswers = false) => {
  const filename = `${sanitizeFileName(meta.title)}.txt`;
  downloadBlob(filename, "text/plain;charset=utf-8", buildPaperText(meta, sections, includeAnswers));
};

export const exportPaperAsHtml = (meta: ExportMeta, sections: ExportSection[], includeAnswers = false) => {
  const filename = `${sanitizeFileName(meta.title)}.html`;
  downloadBlob(filename, "text/html;charset=utf-8", buildPaperHtml(meta, sections, includeAnswers));
};

export const exportPaperAsDoc = (meta: ExportMeta, sections: ExportSection[], includeAnswers = false) => {
  const filename = `${sanitizeFileName(meta.title)}.doc`;
  downloadBlob(filename, "application/msword", buildPaperHtml(meta, sections, includeAnswers));
};

export const exportPaperAsPdf = (meta: ExportMeta, sections: ExportSection[], includeAnswers = false) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const lineHeight = 16;
  const maxWidth = pageWidth - margin * 2;

  const ensureSpace = (needed = lineHeight) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLine = (text: string, opts?: { bold?: boolean; size?: number; indent?: number }) => {
    const size = opts?.size ?? 11;
    const indent = opts?.indent ?? 0;
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(size);

    const wrapped = doc.splitTextToSize(toExportSafeText(text || " ") || " ", maxWidth - indent);
    const blockHeight = wrapped.length * lineHeight;
    ensureSpace(blockHeight + 2);
    doc.text(wrapped, margin + indent, y);
    y += blockHeight;
  };

  let y = margin;
  writeLine(toExportSafeText(meta.institution || ""), { size: 11 });
  writeLine(toExportSafeText(meta.title), { bold: true, size: 16 });
  writeLine(toExportSafeText(`${meta.subject}${meta.code ? ` (${meta.code})` : ""}`), { size: 11 });
  writeLine(
    `Duration: ${meta.durationMinutes} minutes | Total Marks: ${meta.totalMarks}${meta.semester ? ` | Semester: ${meta.semester}` : ""}`,
    { size: 10 },
  );
  if (meta.examType) {
    writeLine(`Exam Type: ${meta.examType}`, { size: 10 });
  }
  y += 8;

  let qNo = 1;

  const drawPdfChart = (question: ExportQuestion) => {
    const chart = parseChartSpec(question.chartSpec);
    const points = Array.isArray(chart?.points) ? chart.points.slice(0, 20) : [];
    if (!points.length) return;

    const x0 = margin + 14;
    const y0 = y + 6;
    const w = maxWidth - 30;
    const h = 140;
    ensureSpace(h + 26);

    doc.setDrawColor(209, 213, 219);
    doc.rect(x0, y0, w, h);

    const padX = 24;
    const padY = 18;
    const plotX = x0 + padX;
    const plotY = y0 + padY;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;

    const ys = points.map((p: any) => Number(p?.y ?? 0));
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const denom = maxY - minY || 1;

    const xy = points.map((p: any, i: number) => {
      const px = plotX + (i / Math.max(points.length - 1, 1)) * plotW;
      const py = plotY + plotH - ((Number(p?.y ?? 0) - minY) / denom) * plotH;
      return { x: px, y: py };
    });

    const xLabel = toExportSafeText(String(chart?.x_label || "X Axis"));
    const yLabel = toExportSafeText(String(chart?.y_label || "Y Axis"));
    const xMin = points[0]?.x;
    const xMax = points[points.length - 1]?.x;

    if ((question.chartType || chart.chart_type) !== "pie") {
      doc.setDrawColor(107, 114, 128);
      doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);
      doc.line(plotX, plotY, plotX, plotY + plotH);
    }

    if ((question.chartType || chart.chart_type) === "bar") {
      const bw = (plotW / points.length) * 0.7;
      doc.setFillColor(37, 99, 235);
      xy.forEach((p) => {
        const bh = plotY + plotH - p.y;
        doc.rect(p.x - bw / 2, p.y, bw, bh, "F");
      });
    } else if ((question.chartType || chart.chart_type) === "scatter") {
      doc.setFillColor(37, 99, 235);
      xy.forEach((p) => doc.circle(p.x, p.y, 2.2, "F"));
    } else {
      doc.setDrawColor(37, 99, 235);
      for (let i = 1; i < xy.length; i++) {
        doc.line(xy[i - 1].x, xy[i - 1].y, xy[i].x, xy[i].y);
      }
      doc.setFillColor(37, 99, 235);
      xy.forEach((p) => doc.circle(p.x, p.y, 1.8, "F"));
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    if ((question.chartType || chart.chart_type) !== "pie") {
      doc.text(xLabel, plotX + plotW / 2, y0 + h - 2, { align: "center" });
      doc.text(yLabel, x0 + 10, plotY + plotH / 2, { angle: 90 });
      doc.text(toExportSafeText(formatAxisValue(xMin)), plotX, y0 + h - 2, { align: "center" });
      doc.text(toExportSafeText(formatAxisValue(xMax)), plotX + plotW, y0 + h - 2, { align: "center" });
      doc.text(toExportSafeText(formatAxisValue(maxY)), plotX - 6, plotY + 4, { align: "right" });
      doc.text(toExportSafeText(formatAxisValue(minY)), plotX - 6, plotY + plotH + 4, { align: "right" });
    }

    y = y0 + h + 18;
  };

  for (const section of sections) {
    writeLine(toExportSafeText(section.title), { bold: true, size: 12 });
    if (section.instructions) {
      writeLine(toExportSafeText(section.instructions), { size: 10 });
    }
    y += 4;

    for (const question of section.questions) {
      writeLine(`${qNo}. (${question.marks}m) ${toExportSafeText(question.text)}`, { size: 11 });
      if (question.options?.length) {
        question.options.forEach((option, idx) => {
          writeLine(`${String.fromCharCode(65 + idx)}. ${normalizeOptionText(option)}`, { indent: 14, size: 10 });
        });
      }

      if (question.chartMode === "student_plot") {
        const chart = parseChartSpec(question.chartSpec);
        if (includeAnswers) {
          writeLine("Reference graph:", { indent: 14, size: 10 });
          drawPdfChart(question);
        } else {
          writeLine("Plot the graph using the generated data points:", { indent: 14, size: 10 });
        }
        if (Array.isArray(chart?.points) && chart.points.length) {
          writeLine(chart.points.slice(0, 10).map((p: any) => `(${p.x}, ${p.y})`).join(", "), { indent: 18, size: 9 });
        }
      }
      if (question.chartMode === "analyze_graph") {
        writeLine("Analyze the generated graph:", { indent: 14, size: 10 });
        drawPdfChart(question);
      }

      if (includeAnswers && question.answer) {
        writeLine(`Answer: ${toExportSafeText(question.answer)}`, { indent: 14, size: 10 });
      }
      y += 4;
      qNo += 1;
    }
    y += 4;
  }

  const filename = `${sanitizeFileName(meta.title)}.pdf`;
  doc.save(filename);
};

export const exportPaperAsLatex = (meta: ExportMeta, sections: ExportSection[], includeAnswers = false) => {
  const filename = `${sanitizeFileName(meta.title)}.tex`;
  downloadBlob(filename, "text/plain;charset=utf-8", buildPaperLatex(meta, sections, includeAnswers));
};

export const openPaperPreviewWindow = (meta: ExportMeta, sections: ExportSection[], includeAnswers = false) => {
  const html = buildPaperHtml(meta, sections, includeAnswers);
  const previewWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!previewWindow) {
    throw new Error("Popup blocked. Allow popups to preview the paper.");
  }
  previewWindow.document.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
};

export const printPaperAsPdf = (meta: ExportMeta, sections: ExportSection[], includeAnswers = false) => {
  const html = buildPaperHtml(meta, sections, includeAnswers);
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    throw new Error("Popup blocked. Allow popups to export as PDF.");
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

export const exportAnswerKeyOnlyAsTxt = (meta: ExportMeta, sections: ExportSection[]) => {
  const lines: string[] = [];
  lines.push(`${meta.title} - Answer Key`);
  lines.push(`${meta.subject}${meta.code ? ` (${meta.code})` : ""}`);
  lines.push("");

  let qNo = 1;
  for (const section of sections) {
    lines.push(section.title);
    for (const question of section.questions) {
      const answer = question.answer?.trim() || "Answer not available";
      lines.push(`${qNo}. ${answer}`);
      qNo += 1;
    }
    lines.push("");
  }

  const filename = `${sanitizeFileName(meta.title)}-answer-key.txt`;
  downloadBlob(filename, "text/plain;charset=utf-8", lines.join("\n"));
};