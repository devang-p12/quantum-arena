import { jsPDF } from "jspdf";

export interface ExportQuestion {
  text: string;
  marks: number;
  type?: string;
  topic?: string;
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
  lines.push(meta.institution || "");
  lines.push(meta.title);
  lines.push(`${meta.subject}${meta.code ? ` (${meta.code})` : ""}`);
  lines.push(
    `Duration: ${meta.durationMinutes} minutes | Total Marks: ${meta.totalMarks}${meta.semester ? ` | Semester: ${meta.semester}` : ""}`,
  );
  if (meta.examType) lines.push(`Exam Type: ${meta.examType}`);
  lines.push("");

  let qNo = 1;
  for (const section of sections) {
    lines.push(section.title);
    if (section.instructions) lines.push(section.instructions);
    lines.push("");
    for (const question of section.questions) {
      lines.push(`${qNo}. (${question.marks}m) ${question.text}`);
      if (question.options?.length) {
        question.options.forEach((option, idx) => {
          lines.push(`   ${String.fromCharCode(65 + idx)}. ${option}`);
        });
      }
      if (includeAnswers && question.answer) {
        lines.push(`   Answer: ${question.answer}`);
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
                .map((opt) => `<li>${escapeHtml(opt)}</li>`)
                .join("")}</ol>`
            : "";

          const answer = includeAnswers && question.answer
            ? `<p class="answer"><strong>Answer:</strong> ${escapeHtml(question.answer)}</p>`
            : "";

          return `
            <li class="question-item">
              <p><strong>${questionNo}.</strong> (${question.marks}m) ${escapeHtml(question.text)}</p>
              ${options}
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
        question.options.forEach((option) => lines.push(`\\item ${esc(option)}`));
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

    const wrapped = doc.splitTextToSize(text || " ", maxWidth - indent);
    const blockHeight = wrapped.length * lineHeight;
    ensureSpace(blockHeight + 2);
    doc.text(wrapped, margin + indent, y);
    y += blockHeight;
  };

  let y = margin;
  writeLine(meta.institution || "", { size: 11 });
  writeLine(meta.title, { bold: true, size: 16 });
  writeLine(`${meta.subject}${meta.code ? ` (${meta.code})` : ""}`, { size: 11 });
  writeLine(
    `Duration: ${meta.durationMinutes} minutes | Total Marks: ${meta.totalMarks}${meta.semester ? ` | Semester: ${meta.semester}` : ""}`,
    { size: 10 },
  );
  if (meta.examType) {
    writeLine(`Exam Type: ${meta.examType}`, { size: 10 });
  }
  y += 8;

  let qNo = 1;
  for (const section of sections) {
    writeLine(section.title, { bold: true, size: 12 });
    if (section.instructions) {
      writeLine(section.instructions, { size: 10 });
    }
    y += 4;

    for (const question of section.questions) {
      writeLine(`${qNo}. (${question.marks}m) ${question.text}`, { size: 11 });
      if (question.options?.length) {
        question.options.forEach((option, idx) => {
          writeLine(`${String.fromCharCode(65 + idx)}. ${option}`, { indent: 14, size: 10 });
        });
      }
      if (includeAnswers && question.answer) {
        writeLine(`Answer: ${question.answer}`, { indent: 14, size: 10 });
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