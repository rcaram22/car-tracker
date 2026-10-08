import { useState } from 'react';
import { writeStorage } from '../lib/storage';

const THEME_KEY = 'car-tracker:theme';

export function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    writeStorage(THEME_KEY, next ? 'dark' : 'light');
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={dark ? 'Modo claro' : 'Modo oscuro'}
      className="fixed bottom-4 left-4 z-30 rounded-full border border-gray-300 bg-white px-2.5 py-1.5 text-lg leading-none shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
