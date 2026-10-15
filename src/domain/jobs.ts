import type { Listing } from './listing';

export const PRIORITIES = ['high', 'medium', 'low'] as const;

export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export function isPriority(v: unknown): v is Priority {
  return PRIORITIES.includes(v as Priority);
}

export interface Job {
  id: string;
  description: string;
  amount?: number;
  priority: Priority;
  createdAt: number;
}

const seed = (
  id: string,
  description: string,
  amount: number | undefined,
  priority: Priority,
) => ({ id: `seed-${id}`, description, amount, priority });

export const SEED_JOBS: Omit<Job, 'createdAt'>[] = [
  seed('cubiertas', 'Cubiertas', 500, 'high'),
  seed('mecanica', 'Mecanica general', 1000, 'high'),
  seed('diamantado', 'Diamantado + Alineacion', 100, 'medium'),
  seed('limpieza', 'Limpieza Interior MVD WASH', 140, 'medium'),
  seed('parabrisas', 'Arreglo parabrisas', undefined, 'medium'),
  seed('laminas', 'Laminas de seguridad', 150, 'medium'),
  seed('suspension', 'Suspension', 500, 'medium'),
  seed('chapa', 'Arreglos chapa Omar', 300, 'medium'),
  seed('tapizados', 'Tapizados/Arreglos interior', 400, 'low'),
  seed('llantas', 'Llantas', 600, 'low'),
  seed('escape', 'Escape', 500, 'low'),
  seed('espirales', 'Espirales', 300, 'low'),
];

export function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort(
    (a, b) =>
      PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
      a.createdAt - b.createdAt,
  );
}

export function setupCost(
  l: Pick<Listing, 'jobIds' | 'extraCost'>,
  jobs: Job[],
): number {
  const checked = new Set(l.jobIds ?? []);
  const fromJobs = jobs
    .filter((j) => checked.has(j.id))
    .reduce((sum, j) => sum + (j.amount ?? 0), 0);
  return fromJobs + (l.extraCost ?? 0);
}
