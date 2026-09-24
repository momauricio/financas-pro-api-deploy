import { describe, expect, it } from 'vitest';
import {
  FREE_MAX_OFFERS,
  FREE_MAX_PRODUCTS,
} from '../../src/modules/price-alerts/price-alerts.schema.js';

describe('price-alerts caps', () => {
  it('keeps Free product cap at 5 (parity with edge + front)', () => {
    expect(FREE_MAX_PRODUCTS).toBe(5);
  });

  it('keeps Free offers-per-product cap at 3 (parity with front)', () => {
    expect(FREE_MAX_OFFERS).toBe(3);
  });
});
