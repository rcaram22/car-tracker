import type { Rating } from '../domain/listing';

const VALUES: Rating[] = [1, 2, 3, 4, 5];

interface Props {
  value?: Rating;
  onChange?: (value: Rating | undefined) => void;
  size?: 'sm' | 'md';
}

export function StarRating({ value, onChange, size = 'md' }: Props) {
  const text = size === 'sm' ? 'text-sm' : 'text-2xl';
  const star = (n: Rating) => (
    <span
      className={
        value !== undefined && n <= value ? 'text-amber-400' : 'text-gray-300'
      }
    >
      ★
    </span>
  );

  if (!onChange) {
    return (
      <span
        role="img"
        aria-label={value ? `${value} de 5 estrellas` : 'Sin calificar'}
        className={`inline-flex leading-none ${text}`}
      >
        {VALUES.map((n) => (
          <span key={n} aria-hidden>
            {star(n)}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Calificación"
      className={`inline-flex leading-none ${text}`}
    >
      {VALUES.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
          onClick={() => onChange(value === n ? undefined : n)}
          className="px-0.5 hover:scale-110"
        >
          {star(n)}
        </button>
      ))}
    </div>
  );
}
