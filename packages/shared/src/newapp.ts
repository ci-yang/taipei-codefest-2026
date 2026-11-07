import { z } from 'zod';

/** newapp（暫名）後端 /healthz 回應：不查 DB，只回服務名稱與時間 */
export const ServiceHealthSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  time: z.string(),
});
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;
