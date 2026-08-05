import type { BackendHealth } from "@/types/backend";

export const BACKEND_BASE_URL = "http://127.0.0.1:3939";

export async function fetchBackendHealth(
  timeoutMs = 3000,
): Promise<BackendHealth> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/health`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    return (await response.json()) as BackendHealth;
  } finally {
    clearTimeout(timer);
  }
}
