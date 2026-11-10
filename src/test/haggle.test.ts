import { describe, expect, it } from "vitest";
import { budgetRange, findProduct, getOffers, negotiate } from "@/lib/haggle";

function run(query: string, budget: number, seed = 42) {
  const product = findProduct(query);
  const offers = getOffers(product, seed);
  return { product, offers, result: negotiate({ productName: product.name, offer: offers[0]!, budget, seed }) };
}

describe("haggle bot negotiation rules", () => {
  it("never offers more than the user's budget", () => {
    for (const q of ["iphone", "sony headphones", "nike", "macbook", "desk lamp"]) {
      const product = findProduct(q);
      const { min, max, step } = budgetRange(product.listPrice);
      for (let b = min; b <= max; b += step * 7) {
        for (let seed = 1; seed < 20; seed++) {
          const { result } = run(q, b, seed);
          for (const o of result.botOffers) expect(o).toBeLessThanOrEqual(b);
        }
      }
    }
  });

  it("a successful deal is always within budget", () => {
    for (let seed = 1; seed < 50; seed++) {
      const { result } = run("sony headphones", 8000, seed);
      if (result.success) expect(result.finalPrice!).toBeLessThanOrEqual(8000);
    }
  });

  it("reports no deal when the seller's lowest price is above budget", () => {
    const { result } = run("sony headphones", 5000);
    expect(result.success).toBe(false);
    expect(result.finalPrice).toBeUndefined();
    expect(result.savings).toBe(0);
  });

  it("savings equal the best found price minus the negotiated price", () => {
    const { offers, result } = run("macbook", 120000);
    expect(result.success).toBe(true);
    expect(result.savings).toBe(offers[0]!.price - result.finalPrice!);
  });

  it("matches Sony headphones at ₹9,499 list price", () => {
    expect(findProduct("Sony headphones").listPrice).toBe(9499);
  });
});
