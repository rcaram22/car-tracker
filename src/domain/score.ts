export const SCORE_ERROR = 'El puntaje va de 1 a 10, en saltos de 0.5';
export const MIGRATED_SCORE = 8.5;

export function isValidScore(n: unknown): n is number {
  return (
    typeof n === 'number' && n >= 1 && n <= 10 && Number.isInteger(n * 2)
  );
}

export function parseScore(raw: string): { value?: number; error?: string } {
  const s = raw.trim().replace(',', '.');
  if (s === '') return { value: undefined };
  const n = /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  return isValidScore(n) ? { value: n } : { error: SCORE_ERROR };
}

export function formatScore(n: number): string {
  return n.toFixed(1);
}

export function scoreTone(n: number): 'good' | 'ok' {
  return n >= 7 ? 'good' : 'ok';
}
