import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

afterEach(() => document.documentElement.classList.remove('dark'));

describe('ThemeToggle', () => {
  it('starts in light mode when nothing is stored', () => {
    render(<ThemeToggle />);
    expect(document.documentElement).not.toHaveClass('dark');
    expect(
      screen.getByRole('button', { name: 'Activar modo oscuro' }),
    ).toBeInTheDocument();
  });

  it('toggles dark mode and remembers the choice', async () => {
    render(<ThemeToggle />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Activar modo oscuro' }),
    );
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('car-tracker:theme')).toBe('dark');

    await userEvent.click(
      screen.getByRole('button', { name: 'Activar modo claro' }),
    );
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('car-tracker:theme')).toBe('light');
  });

  it('restores a stored dark choice', () => {
    localStorage.setItem('car-tracker:theme', 'dark');
    document.documentElement.classList.add('dark');
    render(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: 'Activar modo claro' }),
    ).toBeInTheDocument();
  });
});
