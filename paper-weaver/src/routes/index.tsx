import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileText, Database, ShieldCheck, BookOpen, Plus, Search, FileUp,
  ArrowRight, Eye, Download, Copy, TrendingUp, Sparkles, Trash2, Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { papersService, type Paper } from "@/lib/papersService";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ExamForge" },
      { name: "description", content: "Your command center for AI-assisted exam paper generation." },
    ],
  }),
  component: Dashboard,
});

const quickActions = [
  { label: "New Exam Paper", desc: "Start a paper from scratch", icon: Plus, to: "/create" as const },
  { label: "Browse Question Bank", desc: "Search & filter saved questions", icon: Search, to: "/create" as const },
  { label: "Import Questions", desc: "Bulk import from CSV / JSON", icon: FileUp, to: "/create" as const },
  { label: "View Analytics", desc: "Track quality & usage", icon: TrendingUp, to: "/analytics" as const },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Draft: "bg-amber/15 text-amber border-amber/30",
    "In Progress": "bg-primary/15 text-primary border-primary/30",
    Complete: "bg-teal/15 text-teal border-teal/30",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${map[status] ?? "bg-surface border-border text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function toneClasses(t: "indigo" | "teal" | "violet" | "amber") {
  return {
    indigo: "bg-primary/15 text-primary",
    teal: "bg-teal/15 text-teal",
    violet: "bg-violet/15 text-violet",
    amber: "bg-amber/15 text-amber",
  }[t];
}

function Dashboard() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const user = typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("user") ?? "null")
    : null;
  const displayName: string = user?.name ?? "there";

  const now = new Date().toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const load = async () => {
    try {
      const res = await papersService.list({ page_size: 5 });
      setPapers(res.items);
      setTotal(res.total);
    } catch {
      // silently fail — will show empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this paper?")) return;
    setDeleting(id);
    try {
      await papersService.delete(id);
      setPapers((p) => p.filter((x) => x.id !== id));
      setTotal((t) => (t !== null ? t - 1 : t));
    } finally {
      setDeleting(null);
    }
  };

  const uniqueSubjects = new Set(papers.map((p) => p.subject)).size;

  const statCards = [
    { label: "Papers Generated", value: total !== null ? String(total) : "—", trend: total !== null ? `${total} total` : "Loading...", icon: FileText, tone: "indigo" as const },
    { label: "Questions in Bank", value: "8,347", trend: "+234 added", icon: Database, tone: "teal" as const },
    { label: "Avg. Quality Score", value: "94.2%", trend: "Stable", icon: ShieldCheck, tone: "violet" as const },
    { label: "Active Subjects", value: total !== null ? String(uniqueSubjects) : "—", trend: "from your papers", icon: BookOpen, tone: "amber" as const },
  ];

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Greeting */}
      <section className="relative overflow-hidden rounded-2xl border border-border gradient-hero p-8">
        <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-primary mb-3 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="h-3.5 w-3.5" /> AI assistant ready
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Welcome back, {displayName.split(" ")[0]}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {now} · {total ?? "—"} papers in your workspace
            </p>
          </div>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition glow-indigo"
          >
            <Plus className="h-4 w-4" /> Create New Paper
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl bg-card border border-border p-6 hover:border-primary/40 transition">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneClasses(s.tone)}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className="mt-5 text-3xl font-bold tracking-tight">{s.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-teal">
              <TrendingUp className="h-3 w-3" /> {s.trend}
            </div>
          </div>
        ))}
      </section>

      {/* Two-column */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-6">
        {/* Recent Papers */}
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="flex items-center justify-between p-6 pb-4">
            <div>
              <h2 className="text-lg font-semibold">Recent Papers</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Continue where you left off</p>
            </div>
            <Link to="/create" className="text-xs font-medium text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-y border-border bg-surface/50">
                  <th className="py-3 px-6 font-semibold">Title</th>
                  <th className="py-3 px-2 font-semibold">Subject</th>
                  <th className="py-3 px-2 font-semibold">Status</th>
                  <th className="py-3 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading papers…
                    </td>
                  </tr>
                ) : papers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No papers yet. Click <strong>Create New Paper</strong> to get started!
                    </td>
                  </tr>
                ) : (
                  papers.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition">
                      <td className="py-4 px-6 font-medium">{p.title}</td>
                      <td className="py-4 px-2 text-muted-foreground">{p.subject}</td>
                      <td className="py-4 px-2"><StatusBadge status={p.status} /></td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-1">
                          {[Eye, Download, Copy].map((Icon, i) => (
                            <button
                              key={i}
                              className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition"
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          ))}
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={deleting === p.id}
                            className="h-8 w-8 rounded-md text-muted-foreground hover:text-rose hover:bg-rose/10 flex items-center justify-center transition"
                          >
                            {deleting === p.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl bg-card border border-border p-6">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Jump straight to a workflow</p>
          <div className="mt-5 space-y-2">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="group flex items-center gap-4 p-3.5 rounded-lg bg-surface hover:bg-accent border border-transparent hover:border-primary/30 transition"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                  <a.icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{a.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.desc}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
