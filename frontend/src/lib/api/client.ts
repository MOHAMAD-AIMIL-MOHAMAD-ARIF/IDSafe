// src/lib/api/client.ts

export type ApiOptions = {
  baseUrl?: string;
};

export class ApiClient {
  private baseUrl: string;

  constructor(options: ApiOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  }

  private async parseJson<T>(response: Response): Promise<T> {
    // Some endpoints may return 204 No Content.
    if (response.status === 204) return undefined as T;

    // If server responds with non-JSON (unexpected), surface a useful error.
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Expected JSON response but got "${contentType || "unknown"}" (${response.status}). ${text}`.trim(),
      );
    }

    return (await response.json()) as T;
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      // Try to extract a helpful error message from JSON, then fall back.
      let details = "";
      try {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const data = (await response.json()) as unknown;
          details = ` ${JSON.stringify(data)}`;
        } else {
          const text = await response.text();
          if (text) details = ` ${text}`;
        }
      } catch {
        // Ignore parse failures; we still throw the status below.
      }

      throw new Error(`Request failed (${response.status})${details}`);
    }

    return this.parseJson<T>(response);
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async delete(path: string): Promise<void> {
    // Many DELETE endpoints return 204 No Content, so we don't require JSON.
    await this.request<undefined>("DELETE", path);
  }
}
