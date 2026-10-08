import { useState } from 'react';
import { parseScore } from '../domain/score';
import { inputCls } from './ui';

interface Props {
  value?: number;
  onSave: (value: number | undefined) => void;
}

export function ScoreInput({ value, onSave }: Props) {
  const [text, setText] = useState(value?.toString() ?? '');
  const [error, setError] = useState<string>();

  const commit = () => {
    const parsed = parseScore(text);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setError(undefined);
    if (parsed.value !== value) onSave(parsed.value);
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        aria-label="Puntaje"
        inputMode="decimal"
        placeholder="1–10"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-invalid={!!error}
        className={`${inputCls} !w-20`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
