import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StarRating } from './StarRating';

describe('StarRating', () => {
  it('sets the clicked value', async () => {
    const onChange = vi.fn();
    render(<StarRating value={2} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '3 estrellas' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('clears when clicking the current value', async () => {
    const onChange = vi.fn();
    render(<StarRating value={3} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '3 estrellas' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('is read-only without onChange', () => {
    render(<StarRating value={4} />);
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByLabelText('4 de 5 estrellas')).toBeInTheDocument();
  });
});
