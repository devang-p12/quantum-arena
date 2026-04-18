import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, BookOpen, Loader2 } from "lucide-react";
import { papersService, type QuestionBankEntry } from "@/lib/papersService";

export const Route = createFileRoute("/question-bank")({
  head: () => ({
    meta: [
      { title: "Question Bank — ExamForge" },
      { name: "description", content: "Browse and filter your saved question bank entries." },
    ],
  }),
  component: QuestionBankPage,
});

function QuestionBankPage() {
  const [items, setItems] = useState<QuestionBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState("");
  const [qType, setQType] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const rows = await papersService.listQuestionBank({
        topic: topic || undefined,
        q_type: qType || undefined,
        difficulty: difficulty || undefined,
        page_size: 200,
      });
      setItems(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const qTypes = useMemo(() => Array.from(new Set(items.map((i) => i.q_type))).sort(), [items]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Question Bank</h1>
        <p className="text-sm text-muted-foreground mt-1">Questions from completed papers are available here for reuse.</p>
      </header>

      <section className="rounded-xl bg-card border border-border p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Filter by topic"
            className="w-full h-10 rounded-lg border border-border bg-surface pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={qType}
          onChange={(e) => setQType(e.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">All question types</option>
          {qTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
        >
          <option value="">All difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
        <button
          onClick={() => void load()}
          className="md:col-span-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
        >
          Apply Filters
        </button>
      </section>

      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border text-sm text-muted-foreground">
          {loading ? "Loading..." : `${items.length} question(s)`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border bg-surface/50">
                <th className="py-3 px-5">Topic</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Difficulty</th>
                <th className="py-3 px-3">Bloom</th>
                <th className="py-3 px-3">Marks</th>
                <th className="py-3 px-5">Question</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading question bank...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <BookOpen className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    No entries found.
                  </td>
                </tr>
              ) : (
                items.map((q) => (
                  <tr key={q.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-3 px-5 font-medium">{q.topic}</td>
                    <td className="py-3 px-3">{q.q_type}</td>
                    <td className="py-3 px-3">{q.difficulty}</td>
                    <td className="py-3 px-3">{q.bloom}</td>
                    <td className="py-3 px-3">{q.marks}</td>
                    <td className="py-3 px-5 text-muted-foreground whitespace-pre-wrap">{q.text}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
