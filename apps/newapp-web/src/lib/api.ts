import type { z } from 'zod';

/** 留空時走同源（Vite dev proxy / nginx 反代），手機連開發機最省事 */
const API_BASE = (import.meta.env.VITE_NEWAPP_API_BASE as string | undefined) ?? '';

/** 請求逾時（SUBS-R10）；逾時 fetch 會丟 TimeoutError，呼叫端當失敗處理 */
export const API_TIMEOUT_MS = 8000;

/** fetch + 用 shared 的 zod schema 驗證回應：後端改了契約，前端會立刻報錯而不是默默壞掉 */
export async function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  params?: Record<string, string | number | undefined>,
  options: { timeoutMs?: number } = {},
): Promise<z.infer<S>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== '') qs.set(k, String(v));
  const url = `${API_BASE}${path}${qs.size ? `?${qs}` : ''}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(options.timeoutMs ?? API_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return schema.parse(await res.json());
}
