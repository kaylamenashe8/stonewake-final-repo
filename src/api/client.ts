import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import type { z } from 'zod';

export interface TimedResponse<T> {
  status: number;
  body: T;
  ms: number;
  headers: Record<string, string>;
}

/**
 * Typed API client on Playwright's request fixture. Owned by the API agent.
 * Response time is logged per endpoint as an annotation (a warning, never a failure).
 */
export class ApiClient {
  private token: string | undefined;
  constructor(private readonly request: APIRequestContext, private readonly onTiming?: (k: string, ms: number) => void) {}

  setToken(token: string | undefined): void {
    this.token = token;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return { Accept: 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...extra };
  }

  async call<S extends z.ZodType>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    opts: { data?: unknown; schema?: S; headers?: Record<string, string>; params?: Record<string, string | number> } = {},
  ): Promise<TimedResponse<S extends z.ZodType ? z.infer<S> : unknown>> {
    const start = Date.now();
    const res: APIResponse = await this.request.fetch(url, {
      method,
      headers: this.headers(opts.headers),
      ...(opts.data === undefined ? {} : { data: opts.data }),
      ...(opts.params ? { params: opts.params } : {}),
    });
    const ms = Date.now() - start;
    this.onTiming?.(`${method} ${url}`, ms);
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body stays text */
    }
    if (opts.schema && res.ok()) {
      const parsed = opts.schema.safeParse(body);
      expect(parsed.success, `Schema mismatch for ${method} ${url}: ${parsed.error?.message ?? ''}`).toBe(true);
    }
    return { status: res.status(), body: body as never, ms, headers: res.headers() };
  }
}
