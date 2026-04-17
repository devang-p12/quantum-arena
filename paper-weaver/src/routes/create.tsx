import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Upload, FileText, ListChecks, ScrollText, Download, Check, ArrowRight, ArrowLeft,
  Plus, Trash2, RefreshCw, Pencil, GripVertical, Sparkles, X, Save, FileUp,
  Star, ChevronDown, ChevronUp, Wand2, BookOpen, Clock, Hash, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { papersService } from "@/lib/papersService";
import { sectionsService, questionsService } from "@/lib/sectionsService";
import {
  exportPaperAsDoc,
  exportPaperAsHtml,
  exportPaperAsLatex,
  exportPaperAsPdf,
  exportPaperAsTxt,
  openPaperPreviewWindow,
  type ExportMeta,
  type ExportSection,
} from "@/lib/paperExport";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Paper Creation — ExamForge" },
      { name: "description", content: "Create a complete exam paper end-to-end with AI assistance and live editing." },
    ],
  }),
  component: PaperCreation,
});

/* ---------------- Types ---------------- */

type Difficulty = "Easy" | "Medium" | "Hard";
type BTLevel = "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";
type QType = "MCQ" | "Short Answer" | "Long Answer" | "Numerical" | "True/False" | "Fill in the Blank";

interface Question {
  id: string;
  topic: string;
  type: QType;
  marks: number;
  difficulty: Difficulty;
  bloom: BTLevel;
  text: string;
  options?: string[];
  answer?: string;
  starred?: boolean;
}

interface Section {
  id: string;
  title: string;
  instructions: string;
  questions: Question[];
}

/* ---------------- Constants ---------------- */

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science",
  "English Literature", "History", "Geography", "Economics", "Political Science",
  "Philosophy", "Sociology", "Psychology", "Business Studies", "Accountancy",
];

const Q_TYPES: QType[] = ["MCQ", "Short Answer", "Long Answer", "Numerical", "True/False", "Fill in the Blank"];
const DIFFS: Difficulty[] = ["Easy", "Medium", "Hard"];
const BLOOMS: BTLevel[] = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];

const STEPS = [
  { id: 1, label: "Pattern", icon: Upload, desc: "Upload or describe" },
  { id: 2, label: "Details", icon: FileText, desc: "Subject & metadata" },
  { id: 3, label: "Blueprint", icon: ListChecks, desc: "Sections & slots" },
  { id: 4, label: "Live Paper", icon: ScrollText, desc: "Edit & regenerate" },
  { id: 5, label: "Export", icon: Download, desc: "Download & share" },
] as const;

/* ---------------- Sample seed ---------------- */

const seedSections = (): Section[] => [
  {
    id: "secA",
    title: "Section A — Objective",
    instructions: "Answer all questions. Each carries 1 mark.",
    questions: [
      {
        id: "q1", topic: "Fundamentals", type: "MCQ", marks: 1, difficulty: "Easy", bloom: "Remember",
        text: "Which of the following is NOT a primitive data type in most languages?",
        options: ["Integer", "Boolean", "Array", "Character"], answer: "Array",
      },
      {
        id: "q2", topic: "Fundamentals", type: "True/False", marks: 1, difficulty: "Easy", bloom: "Understand",
        text: "A function can return more than one value directly in standard imperative languages.",
        answer: "False",
      },
      {
        id: "q3", topic: "Concepts", type: "Fill in the Blank", marks: 1, difficulty: "Medium", bloom: "Remember",
        text: "The process of breaking a problem into smaller sub-problems is called __________.",
        answer: "decomposition",
      },
    ],
  },
  {
    id: "secB",
    title: "Section B — Short Answer",
    instructions: "Attempt any four. Each carries 5 marks.",
    questions: [
      {
        id: "q4", topic: "Application", type: "Short Answer", marks: 5, difficulty: "Medium", bloom: "Apply",
        text: "Explain the difference between depth-first and breadth-first traversal with one example each.",
      },
      {
        id: "q5", topic: "Theory", type: "Short Answer", marks: 5, difficulty: "Medium", bloom: "Understand",
        text: "Define normalization in databases and list any two normal forms with their purpose.",
      },
    ],
  },
  {
    id: "secC",
    title: "Section C — Long Answer",
    instructions: "Attempt any two. Each carries 10 marks.",
    questions: [
      {
        id: "q6", topic: "Analysis", type: "Long Answer", marks: 10, difficulty: "Hard", bloom: "Analyze",
        text: "Discuss in detail the evolution of operating systems from batch processing to modern distributed systems, highlighting key milestones.",
      },
    ],
  },
];

/* ---------------- Helpers ---------------- */

const diffTone: Record<Difficulty, string> = {
  Easy: "bg-teal/15 text-teal border-teal/30",
  Medium: "bg-amber/15 text-amber border-amber/30",
  Hard: "bg-rose/15 text-rose border-rose/30",
};

const uid = () => Math.random().toString(36).slice(2, 9);

/* ============================================================
   Main component
   ============================================================ */

function PaperCreation() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [paperId, setPaperId] = useState<string | null>(null);

  const [pattern, setPattern] = useState({
    method: "manual" as "upload" | "manual" | "template",
    notes: "",
    fileName: "",
    fileData: null as File | null,
  });
  const [meta, setMeta] = useState({
    subject: "Computer Science",
    code: "CS-301",
    title: "End Semester Examination",
    duration: "180",
    totalMarks: 100,
    semester: "5",
    examType: "Semester End",
    institution: "University of Excellence",
  });
  const [sections, setSections] = useState<Section[]>([]);

  const totalQuestions = useMemo(
    () => sections.reduce((n, s) => n + s.questions.length, 0),
    [sections]
  );
  const totalMarksCalc = useMemo(
    () => sections.reduce((n, s) => n + s.questions.reduce((m, q) => m + q.marks, 0), 0),
    [sections]
  );

  const prev = () => setStep((s) => Math.max(1, s - 1));

  const next = async () => {
    setSaveError("");
    
    // Step 1: Parse pattern via AI
    if (step === 1) {
      if (pattern.method === "manual" && !pattern.notes.trim()) return setStep(2);
      if (pattern.method === "upload" && !pattern.fileData) return setStep(2);
      
      setSaving(true);
      try {
        const blueprint = await papersService.parsePattern(
          pattern.method === "manual" ? pattern.notes : undefined,
          pattern.method === "upload" ? pattern.fileData || undefined : undefined
        );
        // Pre-fill Step 2 & 3
        setMeta((prev) => ({
          ...prev,
          title: blueprint.title || prev.title,
          subject: blueprint.subject || prev.subject,
          duration: blueprint.duration_minutes ? String(blueprint.duration_minutes) : prev.duration,
          totalMarks: blueprint.total_marks || prev.totalMarks,
        }));
        
        // Give sections and questions temporary IDs so the UI can edit them before Step 3 -> 4 commit
        if (blueprint.sections) {
          const mappedSecs = blueprint.sections.map((s: any) => ({
            id: uid(),
            title: s.title || "Section",
            instructions: s.instructions || "",
            questions: (s.questions || []).map((q: any) => ({
              id: uid(),
              topic: q.topic || "Unknown",
              type: q.type || "Short Answer",
              marks: q.marks || 1,
              difficulty: q.difficulty || "Medium",
              bloom: q.bloom || "Understand",
              text: "Question will be generated based on this slot...",
            })),
          }));
          setSections(mappedSecs);
        }
      } catch (err) {
        console.error(err);
        setSaveError("Failed to parse pattern via AI. Advancing with defaults.");
        setSaving(false);
        // Delay before moving so they see the error if they want? Or just move after a sec.
      }
      setSaving(false);
    }

    if (step === 2) {
      setSaving(true);
      try {
        if (!paperId) {
          const paper = await papersService.create({
            title: meta.title,
            subject: meta.subject,
            duration_minutes: parseInt(meta.duration, 10) || 180,
            total_marks: meta.totalMarks,
            status: "In Progress",
          });
          setPaperId(paper.id);
        } else {
          await papersService.update(paperId, {
            title: meta.title,
            subject: meta.subject,
            duration_minutes: parseInt(meta.duration, 10) || 180,
            total_marks: meta.totalMarks,
          });
        }
      } catch {
        setSaveError("Failed to save paper — check your connection and try again.");
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }

    if (step === 3 && paperId) {
      setSaving(true);
      try {
        // 1. Sync the blueprint structure to the DB
        const existingSections = await sectionsService.list(paperId);
        await Promise.all(existingSections.map((s) => sectionsService.delete(s.id)));

        const updatedSections: Section[] = [];
        for (let i = 0; i < sections.length; i++) {
          const sec = sections[i];
          const newSec = await sectionsService.create(paperId, {
            title: sec.title,
            instructions: sec.instructions,
            order_index: i,
          });
          const newQs: Question[] = [];
          for (let j = 0; j < sec.questions.length; j++) {
            const q = sec.questions[j];
            const newQ = await questionsService.create(newSec.id, {
              topic: q.topic,
              q_type: q.type,
              marks: q.marks,
              difficulty: q.difficulty,
              bloom: q.bloom,
              text: q.text,
              order_index: j,
            });
            newQs.push({ ...q, id: newQ.id });
          }
          updatedSections.push({ ...sec, id: newSec.id, questions: newQs });
        }
        setSections(updatedSections);

        // 2. Trigger hybrid generation (bank-first, AI fallback)
        await papersService.generatePaper(paperId);

        // 3. Reload sections with AI-written question texts from the DB
        const freshSections = await sectionsService.list(paperId);
        const mappedFresh: Section[] = freshSections.map((s: any) => ({
          id: s.id,
          title: s.title,
          instructions: s.instructions || "",
          questions: (s.questions || []).map((q: any) => ({
            id: q.id,
            topic: q.topic,
            type: q.q_type,
            marks: q.marks,
            difficulty: q.difficulty,
            bloom: q.bloom,
            text: q.text,
            options: q.options ? JSON.parse(q.options) : undefined,
            answer: q.answer,
            starred: q.starred,
          })),
        }));
        setSections(mappedFresh);
      } catch (err) {
        console.error(err);
        setSaveError("Failed to generate questions. Try again.");
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    setStep((s) => Math.min(5, s + 1));
  };


  const finish = async () => {
    if (paperId) {
      try { await papersService.update(paperId, { status: "Complete" }); } catch { /* best effort */ }
    }
    navigate({ to: "/" });
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Paper Creation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            From pattern to polished paper — fully editable at every step.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-full bg-surface border border-border text-muted-foreground">
            <span className="text-foreground font-semibold">{totalQuestions}</span> questions
          </div>
          <div className="px-3 py-1.5 rounded-full bg-surface border border-border text-muted-foreground">
            <span className="text-foreground font-semibold">{totalMarksCalc}</span> / {meta.totalMarks} marks
          </div>
        </div>
      </div>

      {/* Stepper */}
      <Stepper step={step} onJump={setStep} />

      {/* Step content */}
      <div className="rounded-2xl bg-card border border-border min-h-[520px]">
        {step === 1 && <StepPattern value={pattern} onChange={setPattern} />}
        {step === 2 && <StepMeta value={meta} onChange={setMeta} />}
        {step === 3 && <StepBlueprint sections={sections} setSections={setSections} />}
        {step === 4 && <StepLivePaper meta={meta} sections={sections} setSections={setSections} />}
        {step === 5 && (
          <StepExport
            meta={meta}
            sections={sections}
            totalQuestions={totalQuestions}
            totalMarks={totalMarksCalc}
          />
        )}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between sticky bottom-4 z-20 rounded-xl bg-surface-elevated/80 backdrop-blur-xl border border-border px-5 py-3 shadow-xl">
        <button
          onClick={prev}
          disabled={step === 1 || saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-xs text-muted-foreground">
            Step <span className="text-foreground font-semibold">{step}</span> of {STEPS.length}
          </div>
          {saveError && <p className="text-[11px] text-rose">{saveError}</p>}
        </div>
        {step < 5 ? (
          <button
            onClick={next}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition glow-indigo disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {step === 1 ? "Processing..." : "Saving..."}</>
            ) : (
              <>{step === 1 ? "Process Pattern" : step === 3 ? "Generate Paper" : "Continue"} <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        ) : (
          <button
            onClick={finish}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal text-background text-sm font-semibold hover:brightness-110 transition"
          >
            <Check className="h-4 w-4" /> Finish & Save
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Stepper
   ============================================================ */

function Stepper({ step, onJump }: { step: number; onJump: (s: number) => void }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
      {STEPS.map((s, i) => {
        const status = step === s.id ? "current" : step > s.id ? "done" : "upcoming";
        const Icon = s.icon;
        return (
          <li key={s.id} className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onJump(s.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition",
                status === "current" && "bg-primary/10 border-primary/40 text-foreground",
                status === "done" && "bg-teal/10 border-teal/30 text-foreground hover:bg-teal/15",
                status === "upcoming" && "bg-surface border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold",
                  status === "current" && "bg-primary text-primary-foreground",
                  status === "done" && "bg-teal text-background",
                  status === "upcoming" && "bg-surface-elevated text-muted-foreground"
                )}
              >
                {status === "done" ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <div className="hidden md:block">
                <div className="text-[11px] uppercase tracking-wider opacity-70">Step {s.id}</div>
                <div className="text-sm font-semibold">{s.label}</div>
              </div>
            </button>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

/* ============================================================
   Step 1 — Pattern
   ============================================================ */

function StepPattern({
  value,
  onChange,
}: {
  value: { method: "upload" | "manual" | "template"; notes: string; fileName: string; fileData: File | null };
  onChange: (v: typeof value) => void;
}) {
  const tabs = [
    { id: "upload" as const, label: "Upload File", icon: FileUp },
    { id: "manual" as const, label: "Describe Manually", icon: Pencil },
    { id: "template" as const, label: "Use Template", icon: BookOpen },
  ];

  const templates = [
    { name: "Standard 100-Mark Theory", desc: "3 sections · MCQ + Short + Long" },
    { name: "MCQ-Only Quick Test", desc: "30 questions · 30 minutes" },
    { name: "Internal Assessment", desc: "20 marks · 1 hour · mixed" },
    { name: "Practical Viva", desc: "10 oral prompts · scenario-based" },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">How would you like to start?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload an existing paper pattern, describe what you need, or pick a starter template.
        </p>
      </div>

      <div className="inline-flex p-1 rounded-full bg-surface border border-border">
        {tabs.map((t) => {
          const active = value.method === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange({ ...value, method: t.id })}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {value.method === "upload" && (
        <label className="block group cursor-pointer">
          <div className="rounded-2xl border-2 border-dashed border-border hover:border-primary/60 bg-surface/50 transition-all p-12 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/15 text-primary flex items-center justify-center group-hover:scale-110 transition">
              <Upload className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-lg font-semibold">Drop your pattern file here</h3>
            <p className="text-sm text-muted-foreground mt-1">
              PDF, DOCX or TXT · or <span className="text-primary underline">browse files</span>
            </p>
            {value.fileName && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs">
                <FileText className="h-3.5 w-3.5" /> {value.fileName}
              </div>
            )}
          </div>
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onChange({ ...value, fileName: file.name, fileData: file });
              }
            }}
          />
        </label>
      )}

      {value.method === "manual" && (
        <div>
          <label className="text-sm font-medium">Describe the paper structure</label>
          <p className="text-xs text-muted-foreground mt-1">
            e.g. "3 sections: 10 MCQs, 5 short answers (5m each), 2 long answers (15m each), focus on chapters 1–4."
          </p>
          <textarea
            value={value.notes}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            rows={8}
            placeholder="Type or paste your pattern description here…"
            className="mt-3 w-full rounded-xl bg-surface border border-border px-4 py-3 font-mono text-sm leading-relaxed focus:outline-none focus:border-primary ring-glow resize-none"
          />
          <div className="mt-3 flex items-center gap-2">
            <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition">
              <Wand2 className="h-3.5 w-3.5" /> Improve with AI
            </button>
            <span className="text-xs text-muted-foreground">{value.notes.length} characters</span>
          </div>
        </div>
      )}

      {value.method === "template" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map((t) => (
            <button
              key={t.name}
              className="text-left rounded-xl bg-surface hover:bg-accent border border-border hover:border-primary/40 p-5 transition group"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <ScrollText className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition" />
              </div>
              <h3 className="mt-4 font-semibold">{t.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Step 2 — Metadata
   ============================================================ */

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-lg bg-surface border border-border px-3.5 py-2.5 text-sm focus:outline-none focus:border-primary ring-glow";

function StepMeta({
  value, onChange,
}: { value: any; onChange: (v: any) => void }) {
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Paper Details</h2>
        <p className="text-sm text-muted-foreground mt-1">
          These appear on the paper header and guide the AI when generating questions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Subject">
          <input
            list="subjects"
            value={value.subject}
            onChange={(e) => set("subject", e.target.value)}
            className={inputCls}
            placeholder="Type or pick a subject"
          />
          <datalist id="subjects">
            {SUBJECTS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </Field>
        <Field label="Subject Code">
          <input value={value.code} onChange={(e) => set("code", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Paper Title">
          <input value={value.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Institution">
          <input value={value.institution} onChange={(e) => set("institution", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Duration (minutes)" hint={<><Clock className="inline h-3 w-3" /></> as any}>
          <input type="number" value={value.duration} onChange={(e) => set("duration", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Total Marks">
          <input type="number" value={value.totalMarks} onChange={(e) => set("totalMarks", Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Semester / Class">
          <input value={value.semester} onChange={(e) => set("semester", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Exam Type">
          <select value={value.examType} onChange={(e) => set("examType", e.target.value)} className={inputCls}>
            {["Semester End", "Mid-term", "Internal", "Quiz", "Surprise Test", "Supplementary"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="rounded-xl bg-surface border border-border p-5 flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">AI Style Guidance</h4>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3">
            Optional notes that influence wording, depth and tone of generated questions.
          </p>
          <textarea
            rows={3}
            placeholder="e.g. Keep language simple. Avoid trick questions. Prefer real-world scenarios from chapters 2 & 4."
            className={`${inputCls} font-mono leading-relaxed resize-none`}
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Step 3 — Blueprint (sections + slots)
   ============================================================ */

function StepBlueprint({
  sections, setSections,
}: { sections: Section[]; setSections: (s: Section[]) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map((s) => [s.id, true]))
  );

  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  const updateSection = (id: string, patch: Partial<Section>) =>
    setSections(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const updateQ = (sid: string, qid: string, patch: Partial<Question>) =>
    setSections(sections.map((s) =>
      s.id !== sid ? s : { ...s, questions: s.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) }
    ));

  const addQ = (sid: string) =>
    setSections(sections.map((s) =>
      s.id !== sid ? s : {
        ...s,
        questions: [...s.questions, {
          id: uid(), topic: "New Topic", type: "Short Answer", marks: 5,
          difficulty: "Medium", bloom: "Understand", text: "",
        }],
      }
    ));

  const removeQ = (sid: string, qid: string) =>
    setSections(sections.map((s) =>
      s.id !== sid ? s : { ...s, questions: s.questions.filter((q) => q.id !== qid) }
    ));

  const addSection = () =>
    setSections([
      ...sections,
      {
        id: uid(),
        title: `Section ${String.fromCharCode(65 + sections.length)} — New Section`,
        instructions: "Answer the following.",
        questions: [],
      },
    ]);

  const removeSection = (id: string) => setSections(sections.filter((s) => s.id !== id));

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Blueprint</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define sections and the question slots inside each. AI will fill these when you generate.
          </p>
        </div>
        <button
          onClick={addSection}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface border border-border text-sm font-medium hover:border-primary/40 hover:text-foreground transition"
        >
          <Plus className="h-4 w-4" /> Add Section
        </button>
      </div>

      <div className="space-y-4">
        {sections.map((s) => {
          const secMarks = s.questions.reduce((n, q) => n + q.marks, 0);
          const isOpen = open[s.id];
          return (
            <div key={s.id} className="rounded-xl border border-border bg-surface/50 overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <button onClick={() => toggle(s.id)} className="text-muted-foreground hover:text-foreground">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <input
                  value={s.title}
                  onChange={(e) => updateSection(s.id, { title: e.target.value })}
                  className="flex-1 bg-transparent text-base font-semibold focus:outline-none"
                />
                <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {s.questions.length} Qs · {secMarks}m
                </span>
                <button
                  onClick={() => removeSection(s.id)}
                  className="h-8 w-8 rounded-md text-muted-foreground hover:text-rose hover:bg-rose/10 flex items-center justify-center transition"
                  aria-label="Delete section"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <input
                    value={s.instructions}
                    onChange={(e) => updateSection(s.id, { instructions: e.target.value })}
                    placeholder="Section instructions"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:border-primary"
                  />

                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="py-2.5 px-3 text-left font-semibold w-10">#</th>
                          <th className="py-2.5 px-3 text-left font-semibold">Topic</th>
                          <th className="py-2.5 px-3 text-left font-semibold">Type</th>
                          <th className="py-2.5 px-3 text-left font-semibold w-20">Marks</th>
                          <th className="py-2.5 px-3 text-left font-semibold">Difficulty</th>
                          <th className="py-2.5 px-3 text-left font-semibold">Bloom Level</th>
                          <th className="py-2.5 px-3 text-right font-semibold w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.questions.map((q, i) => (
                          <tr key={q.id} className="border-t border-border bg-card/40">
                            <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                            <td className="py-2 px-3">
                              <input value={q.topic} onChange={(e) => updateQ(s.id, q.id, { topic: e.target.value })} className="w-full bg-transparent focus:outline-none focus:border-primary border-b border-transparent" />
                            </td>
                            <td className="py-2 px-3">
                              <select value={q.type} onChange={(e) => updateQ(s.id, q.id, { type: e.target.value as QType })} className="bg-surface border border-border rounded px-2 py-1 text-xs">
                                {Q_TYPES.map((t) => <option key={t}>{t}</option>)}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input type="number" value={q.marks} onChange={(e) => updateQ(s.id, q.id, { marks: Number(e.target.value) })} className="w-16 bg-surface border border-border rounded px-2 py-1 text-xs" />
                            </td>
                            <td className="py-2 px-3">
                              <select value={q.difficulty} onChange={(e) => updateQ(s.id, q.id, { difficulty: e.target.value as Difficulty })} className={`text-xs rounded px-2 py-1 border ${diffTone[q.difficulty]}`}>
                                {DIFFS.map((d) => <option key={d} className="bg-surface text-foreground">{d}</option>)}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <select value={q.bloom} onChange={(e) => updateQ(s.id, q.id, { bloom: e.target.value as BTLevel })} className="bg-surface border border-border rounded px-2 py-1 text-xs">
                                {BLOOMS.map((b) => <option key={b}>{b}</option>)}
                              </select>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button onClick={() => removeQ(s.id, q.id)} className="text-muted-foreground hover:text-rose">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={() => addQ(s.id)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Question Slot
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Step 4 — Live Editable Paper
   ============================================================ */

function StepLivePaper({
  meta, sections, setSections,
}: { meta: any; sections: Section[]; setSections: (s: Section[]) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);

  const updateQ = (sid: string, qid: string, patch: Partial<Question>) =>
    setSections(sections.map((s) =>
      s.id !== sid ? s : { ...s, questions: s.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) }
    ));

  const removeQ = async (sid: string, qid: string) => {
    try { await questionsService.delete(qid); } catch {}
    setSections(sections.map((s) =>
      s.id !== sid ? s : { ...s, questions: s.questions.filter((q) => q.id !== qid) }
    ));
  };

  const addQ = async (sid: string) => {
    try {
      const q = await questionsService.create(sid, {
        topic: "Custom", q_type: "Short Answer", marks: 5, difficulty: "Medium", bloom: "Understand", text: "New question — click edit to write."
      });
      setSections(sections.map((s) =>
        s.id !== sid ? s : { ...s, questions: [...s.questions, q as any] }
      ));
    } catch {}
  };

  const regenerate = (sid: string, qid: string) => {
    setRegenId(qid);
    setTimeout(async () => {
      const samples = [
        "Critically analyze the given concept and support your answer with two real-world examples.",
        "Compare and contrast the two approaches, highlighting at least three differences.",
        "Derive the formula step-by-step and discuss any assumptions made.",
        "Evaluate the impact of the topic on contemporary practice in the field.",
        "Construct a brief case study illustrating the concept in action.",
      ];
      const text = samples[Math.floor(Math.random() * samples.length)];
      try { await questionsService.update(qid, { text }); } catch {}
      updateQ(sid, qid, { text });
      setRegenId(null);
    }, 900);
  };

  let qCounter = 0;

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" /> Live Paper Preview
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Click any question to edit. Use the inline tools to delete or regenerate just that question.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal/10 text-teal border border-teal/30">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" /> Auto-saved
          </span>
        </div>
      </div>

      {/* Paper */}
      <article className="mx-auto max-w-3xl rounded-2xl border border-border bg-gradient-to-b from-surface to-card p-8 md:p-12 shadow-2xl">
        <header className="text-center pb-6 border-b border-border">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{meta.institution}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">{meta.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {meta.subject} ({meta.code}) · Semester {meta.semester} · {meta.examType}
          </p>
          <div className="mt-4 flex justify-center gap-6 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {meta.duration} min</span>
            <span className="inline-flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> {meta.totalMarks} marks</span>
          </div>
        </header>

        <div className="mt-8 space-y-10">
          {sections.map((s) => (
            <section key={s.id}>
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <h2 className="text-lg font-bold">{s.title}</h2>
                <button
                  onClick={() => addQ(s.id)}
                  className="text-[11px] inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add Question
                </button>
              </div>
              <p className="text-xs italic text-muted-foreground mb-4">{s.instructions}</p>

              <ol className="space-y-4">
                {s.questions.map((q) => {
                  qCounter += 1;
                  const isEditing = editingId === q.id;
                  const isRegen = regenId === q.id;
                  return (
                    <li
                      key={q.id}
                      className={cn(
                        "group relative rounded-xl border p-4 transition",
                        isEditing
                          ? "border-primary/60 bg-primary/5"
                          : "border-transparent hover:border-border hover:bg-surface/60"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex items-center justify-center h-7 w-7 rounded-md bg-surface-elevated text-xs font-bold text-muted-foreground shrink-0">
                          {qCounter}
                        </span>

                        <div className="flex-1 min-w-0">
                          {/* meta chips */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-2 text-[10px]">
                            <Chip>{q.type}</Chip>
                            <Chip>{q.topic}</Chip>
                            <Chip className={diffTone[q.difficulty]}>{q.difficulty}</Chip>
                            <Chip>{q.bloom}</Chip>
                            <Chip className="bg-primary/10 text-primary border-primary/30 ml-auto">{q.marks}m</Chip>
                          </div>

                          {isRegen ? (
                            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                              <RefreshCw className="h-4 w-4 animate-spin text-primary" /> Regenerating question…
                            </div>
                          ) : isEditing ? (
                            <textarea
                              value={q.text}
                              onChange={(e) => updateQ(s.id, q.id, { text: e.target.value })}
                              rows={3}
                              className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm leading-relaxed focus:outline-none focus:border-primary resize-none"
                              autoFocus
                            />
                          ) : (
                            <p className="text-sm leading-relaxed text-foreground">{q.text || <span className="italic text-muted-foreground">Empty question — click edit to write.</span>}</p>
                          )}

                          {/* MCQ options */}
                          {q.type === "MCQ" && q.options && !isEditing && !isRegen && (
                            <ol className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-1">
                              {q.options.map((o, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                                  <span className="h-5 w-5 rounded-full bg-surface border border-border text-[10px] font-semibold flex items-center justify-center text-foreground">
                                    {String.fromCharCode(65 + i)}
                                  </span>
                                  {o}
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      </div>

                      {/* hover toolbar */}
                      <div className={cn(
                        "absolute top-2 right-2 flex items-center gap-1 transition opacity-0 group-hover:opacity-100",
                        isEditing && "opacity-100"
                      )}>
                        <button
                          onClick={async () => {
                            try { await questionsService.toggleStar(q.id); } catch {}
                            updateQ(s.id, q.id, { starred: !q.starred });
                          }}
                          className={cn("h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent transition",
                            q.starred ? "text-amber" : "text-muted-foreground hover:text-foreground")}
                          title="Star"
                        >
                          <Star className={cn("h-3.5 w-3.5", q.starred && "fill-current")} />
                        </button>
                        <button
                          onClick={() => regenerate(s.id, q.id)}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                          title="Regenerate"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        {isEditing ? (
                          <button
                            onClick={async () => {
                               try { await questionsService.update(q.id, { text: q.text }); } catch {}
                               setEditingId(null);
                            }}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-teal hover:bg-teal/10 transition"
                            title="Save"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingId(q.id)}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => removeQ(s.id, q.id)}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-rose hover:bg-rose/10 transition"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>

        <footer className="mt-10 pt-5 border-t border-border text-center text-[11px] text-muted-foreground">
          — End of Paper —
        </footer>
      </article>
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full border border-border bg-surface text-muted-foreground font-medium",
      className
    )}>
      {children}
    </span>
  );
}

/* ============================================================
   Step 5 — Export
   ============================================================ */

function StepExport({
  meta,
  sections,
  totalQuestions,
  totalMarks,
}: {
  meta: any;
  sections: Section[];
  totalQuestions: number;
  totalMarks: number;
}) {
  const [includeAnswers, setIncludeAnswers] = useState(false);
  const [exportError, setExportError] = useState("");

  const exportMeta: ExportMeta = {
    title: meta.title,
    subject: meta.subject,
    durationMinutes: Number(meta.duration) || 180,
    totalMarks,
    institution: meta.institution,
    code: meta.code,
    semester: meta.semester,
    examType: meta.examType,
  };

  const exportSections: ExportSection[] = sections.map((section) => ({
    title: section.title,
    instructions: section.instructions,
    questions: section.questions.map((question) => ({
      text: question.text,
      marks: question.marks,
      type: question.type,
      topic: question.topic,
      options: question.options,
      answer: question.answer,
    })),
  }));

  const hasQuestions = totalQuestions > 0;

  const runExport = (fn: () => void) => {
    setExportError("");
    if (!hasQuestions) {
      setExportError("Generate at least one question before exporting.");
      return;
    }
    try {
      fn();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    }
  };

  const formats = [
    {
      name: "PDF",
      desc: "Download PDF file",
      color: "rose",
      onClick: () => runExport(() => exportPaperAsPdf(exportMeta, exportSections, includeAnswers)),
    },
    {
      name: "DOCX",
      desc: "Download editable Word-compatible file",
      color: "primary",
      onClick: () => runExport(() => exportPaperAsDoc(exportMeta, exportSections, includeAnswers)),
    },
    {
      name: "LaTeX",
      desc: "Download .tex source",
      color: "violet",
      onClick: () => runExport(() => exportPaperAsLatex(exportMeta, exportSections, includeAnswers)),
    },
    {
      name: "HTML",
      desc: "Open browser preview of this paper",
      color: "teal",
      onClick: () => runExport(() => openPaperPreviewWindow(exportMeta, exportSections, includeAnswers)),
    },
  ];
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Export Your Paper</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a format. You can also generate a separate answer key.
        </p>
      </div>

      <div className="rounded-xl bg-surface border border-border p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <Stat label="Title" value={meta.title} small />
        <Stat label="Subject" value={meta.subject} small />
        <Stat label="Questions" value={String(totalQuestions)} />
        <Stat label="Total Marks" value={String(totalMarks)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {formats.map((f) => (
          <button
            key={f.name}
            onClick={f.onClick}
            className="group text-left rounded-xl bg-surface hover:bg-accent border border-border hover:border-primary/40 p-5 transition flex items-center gap-4 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!hasQuestions}
          >
            <div className={cn(
              "h-12 w-12 rounded-lg flex items-center justify-center text-base font-bold",
              f.color === "rose" && "bg-rose/15 text-rose",
              f.color === "primary" && "bg-primary/15 text-primary",
              f.color === "violet" && "bg-violet/15 text-violet",
              f.color === "teal" && "bg-teal/15 text-teal",
            )}>
              {f.name}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">Download as {f.name}</div>
              <div className="text-xs text-muted-foreground">{f.desc}</div>
            </div>
            <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={includeAnswers}
            onChange={(e) => setIncludeAnswers(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-surface"
          />
          Include answer key in exported files
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runExport(() => exportPaperAsTxt(exportMeta, exportSections, includeAnswers))}
            disabled={!hasQuestions}
            className="px-4 py-2 rounded-lg bg-surface border border-border text-sm font-medium hover:border-primary/40 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Download TXT
          </button>
          <button
            onClick={() => runExport(() => exportPaperAsHtml(exportMeta, exportSections, includeAnswers))}
            disabled={!hasQuestions}
            className="px-4 py-2 rounded-lg bg-surface border border-border text-sm font-medium hover:border-primary/40 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Download HTML
          </button>
        </div>
        {exportError && <p className="text-xs text-rose">{exportError}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber/15 text-amber flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-sm">Also generate an Answer Key</div>
            <p className="text-xs text-muted-foreground">AI drafts model answers per question for your review.</p>
          </div>
        </div>
        <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition">
          Generate Answer Key
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-bold truncate", small ? "text-sm" : "text-2xl")}>{value}</div>
    </div>
  );
}
