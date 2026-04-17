import request from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// Guard: localStorage is not available during SSR (TanStack Start renders on Node.js)
const isBrowser = typeof window !== "undefined";

function persist(tokens: TokenResponse) {
  if (!isBrowser) return;
  localStorage.setItem("access_token", tokens.access_token);
  localStorage.setItem("refresh_token", tokens.refresh_token);
  localStorage.setItem("user", JSON.stringify(tokens.user));
}

function clear() {
  if (!isBrowser) return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
}

export const authService = {
  async register(payload: RegisterPayload): Promise<TokenResponse> {
    const data = await request<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    persist(data);
    return data;
  },

  async login(payload: LoginPayload): Promise<TokenResponse> {
    const data = await request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    persist(data);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await request<void>("/auth/logout", { method: "POST" });
    } finally {
      clear();
    }
  },

  async me(): Promise<User> {
    return request<User>("/auth/me");
  },

  getStoredUser(): User | null {
    if (!isBrowser) return null;
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  },

  isAuthenticated(): boolean {
    if (!isBrowser) return false;
    return !!localStorage.getItem("access_token");
  },
};
