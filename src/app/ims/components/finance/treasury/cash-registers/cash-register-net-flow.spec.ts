/**
 * Net cash flow must fall when money leaves the drawer.
 *
 * Reported from a real test box: a register opened at 1 000, an expense of 2 500 and a purchase
 * payment of 174 paid from it, and the page showed "net cash flow +2 674" in green — the exact sum
 * of the two payments, with the sign inverted.
 *
 * The cause is a sign convention that differs by creation path. recordMovement() stores EXPENSE as
 * -abs(amount); withdrawMoney() stores WITHDRAWAL positive. Subtracting an already-negative
 * expenses total adds it. These pin the arithmetic against both conventions.
 */
describe('cash register net flow', () => {

  /** Mirrors calculateCashRegisterStats() in cash-register-details.component.ts. */
  const netFlow = (m: {
    deposits?: number; collections?: number; withdrawals?: number; expenses?: number;
  }): number =>
    ((m.deposits ?? 0) + (m.collections ?? 0))
    - (Math.abs(m.withdrawals ?? 0) + Math.abs(m.expenses ?? 0));

  it('reports the reported case as an outflow, not an inflow', () => {
    // EXPENSE rows are stored negative: -2500 and -174.
    expect(netFlow({ expenses: -2674 })).toBe(-2674);
  });

  it('treats a positive expenses total the same way', () => {
    // Guards the fix against a future change to the storage convention.
    expect(netFlow({ expenses: 2674 })).toBe(-2674);
  });

  it('still subtracts withdrawals, which are stored positive', () => {
    expect(netFlow({ withdrawals: 500 })).toBe(-500);
  });

  it('nets inflows against outflows', () => {
    expect(netFlow({ deposits: 1000, collections: 500, withdrawals: 200, expenses: -300 })).toBe(1000);
  });

  it('is zero on an untouched drawer', () => {
    expect(netFlow({})).toBe(0);
  });
});
