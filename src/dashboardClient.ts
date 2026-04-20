import { DEFAULT_API_BASE } from "./dashboardConstants";

export function summarizeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createApiRequest(sessionToken: string) {
  return async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${DEFAULT_API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        ...(init?.headers || {}),
      },
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || `Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  };
}

export function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
