import request from "@/lib/api";

export interface Paper {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  duration_minutes: number;
  total_marks: number;
  status: "Draft" | "In Progress" | "Complete";
  instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaperListResponse {
  items: Paper[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreatePaperPayload {
  title: string;
  subject: string;
  duration_minutes?: number;
  total_marks?: number;
  status?: string;
  instructions?: string;
}

export interface UpdatePaperPayload {
  title?: string;
  subject?: string;
  duration_minutes?: number;
  total_marks?: number;
  status?: string;
  instructions?: string;
}

export const papersService = {
  async list(params?: {
    page?: number;
    page_size?: number;
    status?: string;
    subject?: string;
  }): Promise<PaperListResponse> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    if (params?.status) qs.set("status", params.status);
    if (params?.subject) qs.set("subject", params.subject);
    const query = qs.toString() ? `?${qs}` : "";
    return request<PaperListResponse>(`/papers${query}`);
  },

  async create(payload: CreatePaperPayload): Promise<Paper> {
    return request<Paper>("/papers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async get(id: string): Promise<Paper> {
    return request<Paper>(`/papers/${id}`);
  },

  async update(id: string, payload: UpdatePaperPayload): Promise<Paper> {
    return request<Paper>(`/papers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async delete(id: string): Promise<void> {
    return request<void>(`/papers/${id}`, { method: "DELETE" });
  },

  async parsePattern(text?: string, file?: File, examType?: string): Promise<any> {
    const formData = new FormData();
    if (text) formData.append("text", text);
    if (file) formData.append("file", file);
    if (examType) formData.append("exam_type", examType);
    return request<any>("/papers/parse-pattern", { method: "POST", body: formData });
  },

  async generatePaper(paperId: string): Promise<any> {
    return request<any>(`/papers/${paperId}/generate`, { method: "POST" });
  },

  async regenerateQuestion(questionId: string): Promise<any> {
    return request<any>(`/sections/questions/${questionId}/regenerate`, { method: "POST" });
  },

  async refineQuestion(questionId: string, draftText: string): Promise<any> {
    return request<any>(`/sections/questions/${questionId}/refine`, {
      method: "POST",
      body: JSON.stringify({ draft_text: draftText }),
    });
  },

  async generateAnswerKey(paperId: string): Promise<any> {
    return request<any>(`/papers/${paperId}/generate-answer-key`, { method: "POST" });
  },
};
