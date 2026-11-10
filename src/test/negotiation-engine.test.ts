import { describe, expect, it } from "vitest";
import {
  MAX_SELLER_ROUNDS,
  nextBotOffer,
  openingOffer,
  sellerFloor,
  sellerRespond,
} from "@/lib/negotiation-engine";

/** Plays a full server-style negotiation: bot opens, then counters until the seller decides. */
function play(listPrice: number, budget: number, id: string) {
  const floor = sellerFloor(listPrice, id);
  let bot = openingOffer(listPrice, budget);
  const botOffers = [bot];
  for (let round = 1; round <= MAX_SELLER_ROUNDS; round++) {
    const d = sellerRespond({ listPrice, floor, budget, botOffer: bot, round });
    if (d.kind !== "counter") return { d, botOffers, floor };
    bot = nextBotOffer({ lastBotOffer: bot, lastCounter: d.price, budget });
    botOffers.push(bot);
  }
  throw new Error("negotiation did not finish");
}

describe("server negotiation engine", () => {
  it("never offers above the shopper's budget", () => {
    for (const price of [8999, 9499, 79900, 114900]) {
      for (let budget = Math.round(price * 0.4); budget <= price * 1.3; budget += Math.round(price * 0.07)) {
        for (let i = 0; i < 15; i++) {
          const { botOffers } = play(price, budget, `neg-${i}`);
          for (const o of botOffers) expect(o).toBeLessThanOrEqual(budget);
        }
      }
    }
  });

  it("only reports a deal when the agreed price is within budget", () => {
    for (let i = 0; i < 40; i++) {
      const { d } = play(9499, 8000, `neg-${i}`);
      if (d.kind === "accept") expect(d.price).toBeLessThanOrEqual(8000);
      if (d.kind === "final" && d.withinBudget) expect(d.price).toBeLessThanOrEqual(8000);
    }
  });

  it("reports no deal when the seller's lowest price is above budget", () => {
    // Floor is at least 76% of 9,499 (about ₹7,250), so ₹5,000 can never close.
    const { d } = play(9499, 5000, "neg-low");
    expect(d.kind).toBe("final");
    if (d.kind === "final") expect(d.withinBudget).toBe(false);
  });

  it("the seller's lowest price is the same on every call for one negotiation", () => {
    expect(sellerFloor(79900, "abc")).toBe(sellerFloor(79900, "abc"));
  });

  it("rejects a bot offer above budget", () => {
    expect(() => sellerRespond({ listPrice: 9499, floor: 7500, budget: 8000, botOffer: 8500, round: 1 })).toThrow();
  });
});
