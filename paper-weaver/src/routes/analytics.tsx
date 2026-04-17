import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, FileText, Users, Award, Clock } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — ExamForge" },
      { name: "description", content: "Insights on paper generation, quality, difficulty and usage trends." },
    ],
  }),
  component: Analytics,
});

const monthly = [
  { m: "Nov", papers: 8, questions: 92 },
  { m: "Dec", papers: 12, questions: 138 },
  { m: "Jan", papers: 15, questions: 174 },
  { m: "Feb", papers: 18, questions: 220 },
  { m: "Mar", papers: 22, questions: 268 },
  { m: "Apr", papers: 27, questions: 312 },
];

const bySubject = [
  { name: "Computer Sci.", papers: 28 },
  { name: "Mathematics", papers: 24 },
  { name: "Physics", papers: 19 },
  { name: "English", papers: 17 },
  { name: "Geography", papers: 14 },
  { name: "Economics", papers: 12 },
  { name: "History", papers: 9 },
];

const difficulty = [
  { name: "Easy", value: 38, color: "var(--teal)" },
  { name: "Medium", value: 44, color: "var(--amber)" },
  { name: "Hard", value: 18, color: "var(--rose)" },
];

const bloom = [
  { level: "Remember", v: 22 },
  { level: "Understand", v: 28 },
  { level: "Apply", v: 24 },
  { level: "Analyze", v: 14 },
  { level: "Evaluate", v: 8 },
  { level: "Create", v: 4 },
];

const kpis = [
  { label: "Total Papers", value: "142", delta: "+18%", icon: FileText },
  { label: "Avg. Quality", value: "94.2%", delta: "+1.4%", icon: Award },
  { label: "Avg. Time Saved", value: "3.6h", delta: "per paper", icon: Clock },
  { label: "Subjects Covered", value: "18", delta: "+3", icon: Users },
];

const tooltipStyle = {
  background: "oklch(1 0 0)",
  border: "1px solid oklch(0.9 0.01 265)",
  borderRadius: 10,
  color: "oklch(0.2 0.02 265)",
  fontSize: 12,
  boxShadow: "0 8px 24px -8px rgba(0,0,0,0.15)",
};

function Analytics() {
  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Track paper output, question quality and subject coverage.</p>
        </div>
        <div className="flex gap-2">
          {["7d", "30d", "90d", "12m"].map((r, i) => (
            <button
              key={r}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                i === 3
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl bg-card border border-border p-6">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <k.icon className="h-5 w-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal">
                <TrendingUp className="h-3 w-3" /> {k.delta}
              </span>
            </div>
            <div className="mt-5 text-3xl font-bold">{k.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{k.label}</div>
          </div>
        ))}
      </section>

      {/* Trend + Pie */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <div className="rounded-xl bg-card border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Generation Trend</h2>
              <p className="text-xs text-muted-foreground">Papers and questions per month</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="gPapers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--indigo)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--indigo)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gQs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--teal)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--teal)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="questions" stroke="var(--teal)" fill="url(#gQs)" strokeWidth={2} />
                <Area type="monotone" dataKey="papers" stroke="var(--indigo)" fill="url(#gPapers)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-card border border-border p-6">
          <h2 className="text-lg font-semibold">Difficulty Mix</h2>
          <p className="text-xs text-muted-foreground">Across all generated questions</p>
          <div className="h-[260px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={difficulty} dataKey="value" innerRadius={60} outerRadius={95} paddingAngle={3}>
                  {difficulty.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 -mt-2">
            {difficulty.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-semibold">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subjects + Bloom */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-card border border-border p-6">
          <h2 className="text-lg font-semibold">Papers by Subject</h2>
          <p className="text-xs text-muted-foreground">Top subjects this year</p>
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySubject} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent)" }} />
                <Bar dataKey="papers" fill="var(--indigo)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-card border border-border p-6">
          <h2 className="text-lg font-semibold">Bloom's Taxonomy Coverage</h2>
          <p className="text-xs text-muted-foreground">Cognitive levels distribution</p>
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bloom}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="level" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="v" stroke="var(--violet)" strokeWidth={2.5} dot={{ r: 5, fill: "var(--violet)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
