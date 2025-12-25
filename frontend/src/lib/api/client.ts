// src/lib/api/client.ts

export type ApiOptions = {
  baseUrl?: string;
};

export type ApiRequestOptions = {
  headers?: HeadersInit;
  cache?: RequestCache;
  signal?: AbortSignal | null;
};

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export class ApiClient {
  private baseUrl: string;

  constructor(options: ApiOptions = {}) {
    this.baseUrl =
      options.baseUrl ??
      process.env.NEXT_PUBLIC_BACKEND_ORIGIN ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:4000";
  }

  private async parseJson<T>(response: Response): Promise<T> {
    // Some endpoints may return 204 No Content.
    if (response.status === 204) return undefined as T;

    // If server responds with non-JSON (unexpected), surface a useful error.
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await response.text().catch(() => "");
      throw new ApiError(
        `Expected JSON response but got "${contentType || "unknown"}" (${response.status}). ${text}`.trim(),
        response.status,
      );
    }

    return (await response.json()) as T;
  }

  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const headers: HeadersInit = {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
      cache: options.cache,
      signal: options.signal ?? undefined,
    });

    if (!response.ok) {
      // Try to extract a helpful error message from JSON, then fall back.
      let details: unknown;
      let message = `Request failed (${response.status})`;
      try {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          details = await response.json();
          if (typeof details === "object" && details && "error" in details) {
            const maybeError = (details as { error?: string }).error;
            if (maybeError) message = String(maybeError);
          } else {
            message = `${message} ${JSON.stringify(details)}`.trim();
          }
        } else {
          const text = await response.text();
          if (text) message = `${message} ${text}`.trim();
        }
      } catch {
        // Ignore parse failures; we still throw the status below.
      }

      throw new ApiError(message, response.status, details);
    }

    return this.parseJson<T>(response);
  }

  async get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>("GET", path, undefined, options);
  }

  async post<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>("POST", path, body, options);
  }

  async patch<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>("PATCH", path, body, options);
  }

  async put<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>("PUT", path, body, options);
  }

  
  // If an endpoint returns 204, your parseJson already returns undefined as T, so T=void works fine.
  // If an endpoint returns JSON like { ok: true; credentialId: number }, you can type it with <T>.
  async delete<T = void>(path: string, options?: ApiRequestOptions): Promise<T> {
  // Some DELETE endpoints return JSON; others return 204 No Content.
  return this.request<T>("DELETE", path, undefined, options);
  }
}
