import request from "./api";

export interface QuestionBankEntry {
  id: string;
  topic: string;
  q_type: string;
  difficulty: string;
  bloom: string;
  marks: number;
  text: string;
  options?: string;
  answer?: string;
  usage_count: number;
}

export interface QuestionBankListParams {
  topic?: string;
  q_type?: string;
  difficulty?: string;
  bloom?: string;
  is_pyq?: boolean;
}

export const questionBankService = {
  list: (params?: QuestionBankListParams) => {
    const searchParams = new URLSearchParams();
    if (params?.topic) searchParams.append("topic", params.topic);
    if (params?.q_type) searchParams.append("q_type", params.q_type);
    if (params?.difficulty) searchParams.append("difficulty", params.difficulty);
    if (params?.bloom) searchParams.append("bloom", params.bloom);
    if (params?.is_pyq !== undefined) searchParams.append("is_pyq", String(params.is_pyq));
    
    const query = searchParams.toString();
    return request<QuestionBankEntry[]>(`/bank${query ? `?${query}` : ""}`);
  },
  add: (data: Partial<QuestionBankEntry>) => request<QuestionBankEntry>("/bank", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  addBulk: (data: Partial<QuestionBankEntry>[]) => request<QuestionBankEntry[]>("/bank/bulk", {
    method: "POST",
    body: JSON.stringify(data)
  }),
  delete: (id: string) => request<void>(`/bank/${id}`, { method: "DELETE" }),
};
