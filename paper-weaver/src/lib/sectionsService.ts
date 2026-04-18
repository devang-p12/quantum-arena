import request from "@/lib/api";

export interface Section {
  id: string;
  paper_id: string;
  title: string;
  instructions: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  questions: Question[];
}

export interface Question {
  id: string;
  section_id: string;
  topic: string;
  q_type: string;
  marks: number;
  difficulty: "Easy" | "Medium" | "Hard" | "Very Hard";
  bloom: string;
  requires_chart: boolean;
  chart_type: "line" | "bar" | "scatter" | "pie" | null;
  chart_mode: "student_plot" | "analyze_graph" | null;
  chart_spec: string | null;
  text: string;
  options: string | null;   // JSON string for MCQ
  answer: string | null;
  starred: boolean;
  order_index: number;
  difficulty_score: number;
  feedback_count: number;
  created_at: string;
  updated_at: string;
}

export type DifficultyFeedbackLabel = "Too Easy" | "Easy" | "Just Right" | "Hard" | "Too Hard";

// ── Sections ──────────────────────────────────────────────

export const sectionsService = {
  async list(paperId: string): Promise<Section[]> {
    return request<Section[]>(`/papers/${paperId}/sections`);
  },

  async create(paperId: string, payload: {
    title: string; instructions?: string; order_index?: number;
  }): Promise<Section> {
    return request<Section>(`/papers/${paperId}/sections`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async update(sectionId: string, payload: {
    title?: string; instructions?: string; order_index?: number;
  }): Promise<Section> {
    return request<Section>(`/papers/sections/${sectionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async delete(sectionId: string): Promise<void> {
    return request<void>(`/papers/sections/${sectionId}`, { method: "DELETE" });
  },

  async reorder(sectionId: string, items: { id: string; order_index: number }[]): Promise<Section> {
    return request<Section>(`/papers/sections/${sectionId}/reorder`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
  },
};

// ── Questions ─────────────────────────────────────────────

export const questionsService = {
  async list(sectionId: string): Promise<Question[]> {
    return request<Question[]>(`/sections/${sectionId}/questions`);
  },

  async create(sectionId: string, payload: {
    topic: string; q_type?: string; marks?: number;
    difficulty?: string; bloom?: string; text: string;
    requires_chart?: boolean; chart_type?: string | null; chart_mode?: string | null; chart_spec?: string;
    options?: string; answer?: string; order_index?: number;
  }): Promise<Question> {
    return request<Question>(`/sections/${sectionId}/questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async update(questionId: string, payload: Partial<{
    topic: string; q_type: string; marks: number;
    difficulty: string; bloom: string; text: string;
    requires_chart: boolean; chart_type: string | null; chart_mode: string | null; chart_spec: string;
    options: string; answer: string; order_index: number;
  }>): Promise<Question> {
    return request<Question>(`/sections/questions/${questionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async delete(questionId: string): Promise<void> {
    return request<void>(`/sections/questions/${questionId}`, { method: "DELETE" });
  },

  async toggleStar(questionId: string): Promise<Question> {
    return request<Question>(`/sections/questions/${questionId}/star`, { method: "PATCH" });
  },

  async submitDifficultyFeedback(
    questionId: string,
    feedback: DifficultyFeedbackLabel,
  ): Promise<Question> {
    return request<Question>(`/sections/questions/${questionId}/difficulty-feedback`, {
      method: "PATCH",
      body: JSON.stringify({ feedback }),
    });
  },
};
