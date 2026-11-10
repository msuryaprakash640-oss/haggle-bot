// Turn-by-turn simulated seller negotiation used by the server.
// Pure and deterministic: the seller's lowest price is derived from the negotiation id,
// so every server call for the same negotiation sees the same seller behaviour.
// Invariant: the bot's offer is never above the shopper's budget, and a deal is only
// reported when the agreed price is within budget.

import { hashString, seededRandom } from "./haggle";

export const MAX_SELLER_ROUNDS = 3;
const SELLER_STEPS = [0.5, 0.8] as const;

export const money = (n: number) => Math.round(n * 100) / 100;
const roundDown = (n: number, step: number) => Math.floor(n / step) * step;
const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;

/** Seller's hidden lowest simulated price: 76–86% of the listed price. */
export function sellerFloor(listPrice: number, negotiationId: string): number {
  const r = seededRandom(hashString(negotiationId))();
  return money(Math.min(listPrice, roundUp(listPrice * (0.76 + r * 0.1), 50)));
}

/** Seller's counter for rounds before the final one. */
export function sellerCounter(listPrice: number, floor: number, round: number): number {
  const step = SELLER_STEPS[round - 1] ?? 1;
  return money(Math.min(listPrice, Math.max(floor, roundUp(listPrice - (listPrice - floor) * step, 50))));
}

/** Bot's first offer: about 72% of the listed price, never above budget. */
export function openingOffer(listPrice: number, budget: number): number {
  return money(Math.max(1, Math.min(budget, roundDown(listPrice * 0.72, 50))));
}

/** Bot moves 40% of the way toward the seller's last counter, capped at budget and the counter. */
export function nextBotOffer(opts: { lastBotOffer: number; lastCounter: number; budget: number }): number {
  const { lastBotOffer, lastCounter, budget } = opts;
  const target = roundDown(lastBotOffer + (lastCounter - lastBotOffer) * 0.4, 50);
  return money(Math.min(budget, lastCounter, Math.max(lastBotOffer, target)));
}

export type SellerDecision =
  | { kind: "accept"; price: number }
  | { kind: "counter"; price: number; round: number }
  | { kind: "final"; price: number; withinBudget: boolean };

/** Simulated seller's response to a bot offer in a given round (1-based). */
export function sellerRespond(opts: {
  listPrice: number;
  floor: number;
  budget: number;
  botOffer: number;
  round: number;
}): SellerDecision {
  const { listPrice, floor, budget, botOffer, round } = opts;
  if (botOffer > budget) throw new Error("Bot offer above budget");
  if (botOffer >= floor) return { kind: "accept", price: money(botOffer) };
  if (round >= MAX_SELLER_ROUNDS) return { kind: "final", price: floor, withinBudget: floor <= budget };
  return { kind: "counter", price: sellerCounter(listPrice, floor, round), round };
}
