import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoreBadge } from './ScoreBadge';

describe('ScoreBadge', () => {
  it('shows a green badge from 7 up', () => {
    render(<ScoreBadge value={7} />);
    const badge = screen.getByLabelText('Puntaje 7.0');
    expect(badge).toHaveTextContent('7.0');
    expect(badge).toHaveAttribute('data-tone', 'good');
  });

  it('shows a yellow badge below 7', () => {
    render(<ScoreBadge value={6.5} />);
    expect(screen.getByLabelText('Puntaje 6.5')).toHaveAttribute(
      'data-tone',
      'ok',
    );
  });

  it('shows ?? without a score', () => {
    render(<ScoreBadge />);
    expect(screen.getByLabelText('Sin puntaje')).toHaveTextContent('??');
  });
});
