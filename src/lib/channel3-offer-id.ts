import { stableOfferIdentity, type LiveOffer } from "./channel3";

/**
 * Deterministic UUID for a Channel3 retailer offer. This is the id stored in
 * retailer_offers, so it is also the id checkout must receive.
 */
export async function channel3OfferId(productExternalId: string, offer: Pick<LiveOffer, "retailer" | "currency" | "url">) {
  const identity = `${productExternalId}|${offer.retailer}|${offer.currency}|${stableOfferIdentity(offer.url)}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 15) | 80;
  bytes[8] = ((bytes[8] ?? 0) & 63) | 128;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
