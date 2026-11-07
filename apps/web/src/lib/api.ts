import type { z } from 'zod';

/** 留空時走同源。定位只留在裝置，不由資料 adapter 組成查詢。 */
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
export const REQUEST_TIMEOUT_MS = 15_000;
export interface RequestOptions { signal?: AbortSignal; timeoutMs?: number }

/** Shared by API and local assets, including body reading and schema validation. */
export async function fetchValidated<S extends z.ZodType>(url: string, schema: S, options: RequestOptions = {}): Promise<z.infer<S>> {
  const controller = new AbortController();
  const cancel = (): void => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('讀取逾時，請重試。')), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`讀取失敗（HTTP ${res.status}），請重試。`);
    const parsed = schema.safeParse(await res.json());
    if (!parsed.success) throw new Error('資料格式不符，請重新載入或稍後再試。');
    return parsed.data;
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}

/** Existing callers retain the third params argument; new callers may pass cancellation fourth. */
export async function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  params?: Record<string, string | number | undefined>,
  options: RequestOptions = {},
): Promise<z.infer<S>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== '') qs.set(k, String(v));
  return fetchValidated(`${API_BASE}${path}${qs.size ? `?${qs}` : ''}`, schema, options);
}
