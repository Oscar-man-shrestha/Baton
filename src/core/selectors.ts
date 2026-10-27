import { z } from 'zod';
import bundled from '../selectors.json';

const providerSchema = z.object({ hosts: z.array(z.string()), turns: z.array(z.string()), editor: z.array(z.string()), artifacts: z.array(z.string()) });
export const selectorSchema = z.object({ version: z.number().int().positive(), updatedAt: z.string(), providers: z.record(z.string(), providerSchema) });
export type SelectorBundle = z.infer<typeof selectorSchema>;
export const bundledSelectors: SelectorBundle = selectorSchema.parse(bundled);
export type ProviderId = keyof typeof bundled.providers;
export const providerIds = Object.keys(bundled.providers) as ProviderId[];

export async function loadSelectors(): Promise<SelectorBundle> {
  const saved = await chrome.storage.local.get('remoteSelectors');
  const parsed = selectorSchema.safeParse(saved.remoteSelectors);
  return parsed.success && parsed.data.version >= bundledSelectors.version ? parsed.data : bundledSelectors;
}
