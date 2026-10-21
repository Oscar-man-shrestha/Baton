import type { Meter } from './limits';
import { isCurrentReading } from './usage-windows';

export type BadgeRecord = { meters: Meter[] };
export function currentBadge(record: BadgeRecord | undefined, now = Date.now()): Meter | undefined {
  return (Array.isArray(record?.meters) ? record.meters : []).filter(meter => isCurrentReading(meter, now)).sort((a, b) => (b.percent || 0) - (a.percent || 0))[0];
}
export function updateBadge(record: BadgeRecord | undefined, meter: Meter, now = Date.now()): BadgeRecord {
  const meters = (Array.isArray(record?.meters) ? record.meters : []).filter(old => isCurrentReading(old, now) && old.feature !== meter.feature && old.provider === meter.provider);
  if (isCurrentReading(meter, now)) meters.push(meter);
  return { meters };
}
// All storage read/modify/write operations share one queue in the worker.
export function usageQueue(): <T>(operation: () => Promise<T>) => Promise<T> {
  let pending: Promise<unknown> = Promise.resolve();
  return operation => {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  };
}
