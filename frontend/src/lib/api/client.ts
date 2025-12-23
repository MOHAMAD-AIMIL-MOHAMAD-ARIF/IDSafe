export type ApiOptions = {
  baseUrl?: string;
};

export class ApiClient {
  private baseUrl: string;

  constructor(options: ApiOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    return (await response.json()) as T;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    return (await response.json()) as T;
  }
}
