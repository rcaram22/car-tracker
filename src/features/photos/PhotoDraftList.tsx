import { useObjectUrl } from '../../lib/useObjectUrl';
import {
  moveDraft,
  removeDraft,
  setCoverDraft,
  type PhotoDraft,
  type PhotoDraftState,
} from './photoDrafts';

interface Props {
  state: PhotoDraftState;
  onChange: (fn: (s: PhotoDraftState) => PhotoDraftState) => void;
}

export function PhotoDraftList({ state, onChange }: Props) {
  if (!state.items.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {state.items.map((d, i) => (
        <DraftThumb
          key={d.key}
          draft={d}
          isCover={d.key === state.coverKey}
          isFirst={i === 0}
          isLast={i === state.items.length - 1}
          onRemove={() => onChange((s) => removeDraft(s, d.key))}
          onMove={(delta) => onChange((s) => moveDraft(s, d.key, delta))}
          onCover={() => onChange((s) => setCoverDraft(s, d.key))}
        />
      ))}
    </ul>
  );
}

interface ThumbProps {
  draft: PhotoDraft;
  isCover: boolean;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
  onCover: () => void;
}

function DraftThumb({
  draft,
  isCover,
  isFirst,
  isLast,
  onRemove,
  onMove,
  onCover,
}: ThumbProps) {
  const url = useObjectUrl(draft.data, draft.type);
  const iconBtn = 'rounded px-1.5 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30';
  return (
    <li
      className={`relative overflow-hidden rounded-lg border-2 bg-white dark:bg-gray-800 ${
        isCover ? 'border-blue-500' : 'border-transparent'
      }`}
    >
      {url && (
        <img src={url} alt="" className="aspect-square w-full object-cover" />
      )}
      {isCover && (
        <span className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-xs text-white">
          Portada
        </span>
      )}
      <div className="flex items-center justify-between p-1 text-sm">
        <button
          type="button"
          aria-label="Mover a la izquierda"
          disabled={isFirst}
          onClick={() => onMove(-1)}
          className={iconBtn}
        >
          ←
        </button>
        {!isCover && (
          <button
            type="button"
            onClick={onCover}
            className={`${iconBtn} text-xs`}
          >
            Usar de portada
          </button>
        )}
        <button
          type="button"
          aria-label="Quitar foto"
          onClick={onRemove}
          className={`${iconBtn} text-red-600 dark:text-red-400`}
        >
          ✕
        </button>
        <button
          type="button"
          aria-label="Mover a la derecha"
          disabled={isLast}
          onClick={() => onMove(1)}
          className={iconBtn}
        >
          →
        </button>
      </div>
    </li>
  );
}
