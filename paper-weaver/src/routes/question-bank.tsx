import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Upload, Trash2, Database, Loader2 } from "lucide-react";
import { questionBankService, type QuestionBankEntry } from "@/lib/questionBankService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/question-bank")({
  head: () => ({
    meta: [
      { title: "Question Bank — ExamForge" },
      { name: "description", content: "Manage and curate your assessment questions." },
    ],
  }),
  component: QuestionBank,
});

function QuestionBank() {
  const [questions, setQuestions] = useState<QuestionBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [filterTopic, setFilterTopic] = useState("");
  const [filterQType, setFilterQType] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterBloom, setFilterBloom] = useState("");
  const [filterIsPyq, setFilterIsPyq] = useState<"" | "pyq" | "nonpyq">("");

  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single Add Form State
  const [topic, setTopic] = useState("");
  const [qType, setQType] = useState("Short Answer");
  const [difficulty, setDifficulty] = useState("Medium");
  const [bloom, setBloom] = useState("Understand");
  const [marks, setMarks] = useState("1");
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [isPyqAdd, setIsPyqAdd] = useState(false);

  // Bulk Add Form State
  const [bulkJson, setBulkJson] = useState("");
  const [bulkError, setBulkError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await questionBankService.list({
        topic: filterTopic || undefined,
        q_type: filterQType || undefined,
        difficulty: filterDifficulty || undefined,
        bloom: filterBloom || undefined,
        is_pyq: filterIsPyq === "" ? undefined : filterIsPyq === "pyq",
      });
      setQuestions(data);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterQType, filterDifficulty, filterBloom, filterIsPyq]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const clearFilters = () => {
    setFilterTopic("");
    setFilterQType("");
    setFilterDifficulty("");
    setFilterBloom("");
    setFilterIsPyq("");
    // load is triggered by useEffect on selects, but run explicitly for topic clearing
    setTimeout(load, 0); 
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    setDeleting(id);
    try {
      await questionBankService.delete(id);
      setQuestions((q) => q.filter((x) => x.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newQuestion = await questionBankService.add({
        topic,
        q_type: qType,
        difficulty,
        bloom,
        marks: parseInt(marks, 10) || 1,
        text,
        answer,
        is_pyq: isPyqAdd,
      });
      setQuestions((prev) => [newQuestion, ...prev]);
      setAddOpen(false);
      setText("");
      setAnswer("");
      setIsPyqAdd(false);
    } catch (err: any) {
      alert(err.message || "Failed to add question");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkSubmit = async () => {
    setBulkError("");
    setIsSubmitting(true);
    try {
      const parsed = JSON.parse(bulkJson);
      if (!Array.isArray(parsed)) throw new Error("Input must be a JSON array.");
      
      const newQuestions = await questionBankService.addBulk(parsed);
      setQuestions((prev) => [...newQuestions, ...prev]);
      setBulkOpen(false);
      setBulkJson("");
    } catch (err: any) {
      setBulkError(err.message || "Invalid JSON or server error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-12">
      <section className="relative overflow-hidden rounded-2xl border border-border gradient-hero p-8">
        <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-primary mb-3 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              <Database className="h-3.5 w-3.5" /> Question Library
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Question Bank</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage, create, and bulk-import questions.
            </p>
          </div>
          <div className="flex gap-3">
             <button
              onClick={() => setBulkOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-surface border border-border hover:border-primary/40 text-sm font-semibold transition"
            >
              <Upload className="h-4 w-4" /> Bulk Import
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition glow-indigo"
            >
              <Plus className="h-4 w-4" /> Add Question
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-card border border-border p-5 flex flex-col sm:flex-row gap-4 items-center">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2 w-full">
            <input 
              value={filterTopic} 
              onChange={e => setFilterTopic(e.target.value)} 
              placeholder="Search topic or keyword..." 
              className="flex-1 h-10 px-3 rounded-lg border border-border bg-surface text-sm max-w-sm" 
            />
            <button type="submit" className="px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition">
              Search
            </button>
        </form>
        <div className="flex gap-2 w-full sm:w-auto">
            <select value={filterQType} onChange={e => setFilterQType(e.target.value)} className="h-10 px-3 rounded-lg border border-border bg-surface text-sm">
                <option value="">All Types</option>
                <option value="Short Answer">Short Answer</option>
                <option value="Multiple Choice">Multiple Choice</option>
                <option value="Long Answer">Long Answer</option>
            </select>
            <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} className="h-10 px-3 rounded-lg border border-border bg-surface text-sm">
                <option value="">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
            </select>
            <select value={filterBloom} onChange={e => setFilterBloom(e.target.value)} className="h-10 px-3 rounded-lg border border-border bg-surface text-sm">
                <option value="">All Bloom Levels</option>
                <option value="Remember">Remember</option>
                <option value="Understand">Understand</option>
                <option value="Apply">Apply</option>
                <option value="Analyze">Analyze</option>
                <option value="Evaluate">Evaluate</option>
                <option value="Create">Create</option>
            </select>
            <select value={filterIsPyq} onChange={e => setFilterIsPyq(e.target.value as any)} className="h-10 px-3 rounded-lg border border-border bg-surface text-sm">
                <option value="">All</option>
                <option value="pyq">PYQ</option>
                <option value="nonpyq">Non-PYQ</option>
            </select>
            {(filterTopic || filterQType || filterDifficulty || filterBloom || filterIsPyq) && (
                <button onClick={clearFilters} className="px-3 h-10 rounded-lg text-rose text-sm font-medium hover:bg-rose/10 transition">
                  Clear
                </button>
            )}
        </div>
      </section>

      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-lg font-semibold">{questions.length} Questions Listed</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-y border-border bg-surface/50">
                <th className="py-3 px-6 font-semibold">Question Text</th>
                <th className="py-3 px-2 font-semibold">Details</th>
                <th className="py-3 px-2 font-semibold">Marks</th>
                <th className="py-3 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading questions…
                  </td>
                </tr>
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-muted-foreground">
                    <Database className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No questions in the bank. Click <strong>Add Question</strong> or <strong>Bulk Import</strong>.
                  </td>
                </tr>
              ) : (
                questions.map((q) => (
                  <tr key={q.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition">
                    <td className="py-4 px-6 font-medium">
                        <div className="line-clamp-2 max-w-[600px]">{q.text}</div>
                        {q.answer && <div className="text-xs text-muted-foreground mt-1 line-clamp-1">Ans: {q.answer}</div>}
                        {q.is_pyq && (
                          <div className="mt-2">
                            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">PYQ</span>
                          </div>
                        )}
                    </td>
                    <td className="py-4 px-2 text-muted-foreground text-[11px] uppercase">
                       <span className="block">{q.topic}</span>
                       <span className="block mt-0.5 opacity-80">{q.q_type} · {q.difficulty}</span>
                    </td>
                    <td className="py-4 px-2">{q.marks}</td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleDelete(q.id)}
                          disabled={deleting === q.id}
                          className="h-8 w-8 rounded-md text-muted-foreground hover:text-rose hover:bg-rose/10 flex items-center justify-center transition"
                        >
                          {deleting === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Single Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Question</DialogTitle>
            <DialogDescription>Manually add a single question to the bank.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-sm font-medium">Topic</label>
                  <input required value={topic} onChange={e => setTopic(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm" placeholder="e.g. Thermodynamics" />
               </div>
               <div className="space-y-1">
                  <label className="text-sm font-medium">Marks</label>
                  <input required type="number" min="1" value={marks} onChange={e => setMarks(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm" />
               </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
               <div className="space-y-1">
                  <label className="text-sm font-medium">Question Type</label>
                  <select value={qType} onChange={e => setQType(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm">
                     <option>Short Answer</option>
                     <option>Multiple Choice</option>
                     <option>Long Answer</option>
                  </select>
               </div>
               <div className="space-y-1">
                  <label className="text-sm font-medium">Difficulty</label>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm">
                     <option>Easy</option>
                     <option>Medium</option>
                     <option>Hard</option>
                  </select>
               </div>
               <div className="space-y-1">
                  <label className="text-sm font-medium">Bloom's Level</label>
                  <select value={bloom} onChange={e => setBloom(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm">
                     <option>Remember</option>
                     <option>Understand</option>
                     <option>Apply</option>
                     <option>Analyze</option>
                     <option>Evaluate</option>
                     <option>Create</option>
                  </select>
               </div>
            </div>
            <div className="space-y-1">
               <label className="text-sm font-medium">Question Text</label>
               <textarea required value={text} onChange={e => setText(e.target.value)} rows={3} className="w-full p-3 rounded-lg border border-border bg-surface text-sm" placeholder="What is the first law..." />
            </div>
            <div className="space-y-1">
               <label className="text-sm font-medium">Answer (Optional)</label>
               <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={2} className="w-full p-3 rounded-lg border border-border bg-surface text-sm" placeholder="Energy cannot be..." />
            </div>
            <div className="flex items-center space-x-2">
               <input type="checkbox" id="isPyq" checked={isPyqAdd} onChange={e => setIsPyqAdd(e.target.checked)} className="h-4 w-4" />
               <label htmlFor="isPyq" className="text-sm font-medium">Mark as Previous Year Question (PYQ)</label>
            </div>
            <DialogFooter className="pt-4">
              <button disabled={isSubmitting} type="submit" className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 disabled:opacity-50 inline-flex items-center gap-2">
                 {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Save Question
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import</DialogTitle>
            <DialogDescription>Paste a JSON array of questions to add multiple questions at once.</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-4">
             {bulkError && (
                 <div className="p-3 text-sm text-rose bg-rose/10 rounded border border-rose/20">
                     {bulkError}
                 </div>
             )}
             <textarea 
                value={bulkJson} 
                onChange={e => setBulkJson(e.target.value)} 
                rows={10} 
                className="w-full p-3 font-mono text-xs rounded-lg border border-border bg-surface" 
                placeholder={'[\n  {\n    "topic": "Physics",\n    "text": "What is gravity?",\n    "q_type": "Short Answer",\n    "difficulty": "Easy",\n    "bloom": "Understand",\n    "marks": 2\n  }\n]'} 
             />
             <DialogFooter>
                <button disabled={isSubmitting || !bulkJson.trim()} onClick={handleBulkSubmit} className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 disabled:opacity-50 inline-flex items-center gap-2">
                   {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Import Questions
                </button>
             </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
