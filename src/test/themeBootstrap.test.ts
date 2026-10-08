import { afterEach, describe, expect, it } from 'vitest';
import html from '../../index.html?raw';

const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
const runBootstrap = () => new Function(script)();

afterEach(() => document.documentElement.classList.remove('dark'));

describe('theme bootstrap in index.html', () => {
  it('defaults to dark when nothing is stored', () => {
    runBootstrap();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('keeps light when the user chose it', () => {
    localStorage.setItem('car-tracker:theme', 'light');
    runBootstrap();
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
