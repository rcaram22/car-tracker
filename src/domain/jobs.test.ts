import { describe, expect, it } from 'vitest';
import { listingTotal } from './format';
import { SEED_JOBS, setupCost, sortJobs, type Job } from './jobs';

const job = (id: string, priority: Job['priority'], amount?: number): Job => ({
  id,
  description: id,
  amount,
  priority,
  createdAt: 0,
});

describe('seed jobs', () => {
  it('has the 12 jobs from the spreadsheet with stable ids', () => {
    expect(SEED_JOBS).toHaveLength(12);
    expect(new Set(SEED_JOBS.map((j) => j.id)).size).toBe(12);
    expect(SEED_JOBS.find((j) => j.description === 'Arreglo parabrisas'))
      .toMatchObject({ amount: undefined, priority: 'medium' });
    expect(SEED_JOBS.find((j) => j.description === 'Arreglos chapa Omar'))
      .toMatchObject({ amount: 300, priority: 'medium' });
  });
});

describe('sortJobs', () => {
  it('orders by priority, then by creation', () => {
    const jobs = [
      { ...job('b', 'low'), createdAt: 1 },
      { ...job('a', 'high'), createdAt: 2 },
      { ...job('c', 'medium'), createdAt: 3 },
      { ...job('d', 'high'), createdAt: 1 },
    ];
    expect(sortJobs(jobs).map((j) => j.id)).toEqual(['d', 'a', 'c', 'b']);
  });
});

describe('setupCost', () => {
  const jobs = [job('tires', 'high', 500), job('glass', 'medium')];

  it('adds checked jobs and other costs', () => {
    expect(
      setupCost({ jobIds: ['tires', 'glass'], extraCost: 200 }, jobs),
    ).toBe(700);
  });

  it('ignores jobs deleted from the catalog', () => {
    expect(setupCost({ jobIds: ['tires', 'gone'] }, jobs)).toBe(500);
  });

  it('is zero with nothing checked and no other costs', () => {
    expect(setupCost({}, jobs)).toBe(0);
  });

  it('feeds the listing total', () => {
    expect(
      listingTotal({ price: 9000, jobIds: ['tires'], extraCost: 100 }, jobs),
    ).toBe(9600);
    expect(listingTotal({ jobIds: ['tires'] }, jobs)).toBeUndefined();
  });
});
