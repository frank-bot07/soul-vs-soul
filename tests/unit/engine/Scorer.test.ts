import { describe, it, expect } from 'vitest';
import { NormalizedScore } from '../../../src/engine/Scorer.js';

describe('NormalizedScore', () => {
  it('clamps to 0 for negative values', () => {
    expect(new NormalizedScore(-10).value).toBe(0);
  });

  it('clamps to 100 for values over 100', () => {
    expect(new NormalizedScore(150).value).toBe(100);
  });

  it('rounds to integer', () => {
    expect(new NormalizedScore(55.7).value).toBe(56);
    expect(new NormalizedScore(55.3).value).toBe(55);
  });

  it('handles 0', () => {
    expect(new NormalizedScore(0).value).toBe(0);
  });

  it('handles 100', () => {
    expect(new NormalizedScore(100).value).toBe(100);
  });

  it('handles NaN', () => {
    expect(new NormalizedScore(NaN).value).toBe(0);
  });

  it('handles Infinity', () => {
    expect(new NormalizedScore(Infinity).value).toBe(0);
  });

  it('handles -Infinity', () => {
    expect(new NormalizedScore(-Infinity).value).toBe(0);
  });
});
