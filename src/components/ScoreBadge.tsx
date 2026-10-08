import { formatScore, scoreTone } from '../domain/score';

const TONES = {
  good: 'bg-green-700 text-white',
  ok: 'bg-amber-400 text-gray-900',
};

export function ScoreBadge({
  value,
  size = 'md',
}: {
  value?: number;
  size?: 'sm' | 'md';
}) {
  const box =
    size === 'sm' ? 'min-w-8 px-1.5 py-0.5 text-sm' : 'min-w-11 px-2 py-1 text-lg';
  if (value === undefined) {
    return (
      <span
        aria-label="Sin puntaje"
        className={`inline-block rounded-md rounded-bl-none bg-gray-200 text-center font-bold text-gray-500 ${box}`}
      >
        ??
      </span>
    );
  }
  const tone = scoreTone(value);
  return (
    <span
      aria-label={`Puntaje ${formatScore(value)}`}
      data-tone={tone}
      className={`inline-block rounded-md rounded-bl-none text-center font-bold ${TONES[tone]} ${box}`}
    >
      {formatScore(value)}
    </span>
  );
}
