import { z } from 'zod';

export const nauticManagerImportBodySchema = z.object({
  csv: z.string().min(1, 'Fichier CSV requis').max(15_000_000),
  dryRun: z.boolean().optional().default(true),
});

export type NauticManagerImportBody = z.infer<typeof nauticManagerImportBodySchema>;
