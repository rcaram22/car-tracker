import { describe, expect, it } from 'vitest';
import { formatScore, parseScore, scoreTone } from './score';

describe('parseScore', () => {
  it.each([
    ['8.5', 8.5],
    ['8,5', 8.5],
    ['10', 10],
    ['1', 1],
    [' 7 ', 7],
    ['7.0', 7],
  ])('accepts %s', (raw, value) => {
    expect(parseScore(raw)).toEqual({ value });
  });

  it('treats empty input as no score', () => {
    expect(parseScore('  ')).toEqual({ value: undefined });
  });

  it.each(['0', '0.5', '11', '10.5', '8.3', '8.55', 'abc', '-5'])(
    'rejects %s',
    (raw) => {
      expect(parseScore(raw).error).toBe(
        'El puntaje va de 1 a 10, en saltos de 0.5',
      );
    },
  );
});

describe('score display', () => {
  it('formats with one decimal', () => {
    expect(formatScore(8)).toBe('8.0');
    expect(formatScore(8.5)).toBe('8.5');
  });

  it('is good from 7 up and ok below', () => {
    expect(scoreTone(7)).toBe('good');
    expect(scoreTone(10)).toBe('good');
    expect(scoreTone(6.5)).toBe('ok');
    expect(scoreTone(1)).toBe('ok');
  });
});
