import { z } from 'zod';

export const HealthSchema = z.object({
  ok: z.boolean(),
  db: z.enum(['up', 'down']),
  postgis: z.string().nullable(),
  time: z.string(),
});
export type Health = z.infer<typeof HealthSchema>;
