import { describe, expect, it } from "vitest";
import { eligibleOffers, normalizeProduct, offerSummary, stableOfferIdentity } from "@/lib/channel3";
import { searchProductsSchema } from "@/lib/backend/schemas";
import { createSearchLimiter } from "@/lib/search-limit";

const rawProduct = { id: "real-product", title: "Headphones", brands: [{ name: "Philips" }], images: [{ url: "https://cdn.trychannel3.com/headphones.jpg", is_main_image: true }], offers: [
  { domain: "shop-one.com", price: { price: 49.49, currency: "USD" }, availability: "InStock", url: "https://buy.trychannel3.com/product?o=one&aid=first" },
  { domain: "shop-two.com", price: { price: 60, currency: "USD" }, availability: "LimitedAvailability", url: "https://shop-two.com/product" },
  { domain: "shop-three.com", price: { price: 10, currency: "USD" }, availability: "OutOfStock" },
  { domain: "shop-four.com", price: { price: 20, currency: "GBP" }, availability: "InStock" },
] };

describe("Channel3 product rules", () => {
  it("only returns available offers within the maximum budget in the chosen currency", () => {
    const product = normalizeProduct(rawProduct);
    expect(eligibleOffers(product?.offers ?? [], "USD", 49.49).map((o) => o.price)).toEqual([49.49]);
    expect(eligibleOffers(product?.offers ?? [], "USD", 49.48)).toEqual([]);
  });
  it("compares multiple retailer offers without including out-of-stock or foreign-currency prices", () => {
    expect(offerSummary(normalizeProduct(rawProduct)?.offers ?? [], "USD")).toEqual({ lowest: 49.49, highest: 60, savings: 10.51 });
  });
  it("does not invent missing prices or availability", () => {
    const p = normalizeProduct({ ...rawProduct, offers: [{ domain: "no-price.com", availability: "InStock" }, { domain: "unknown.com", price: { price: 25, currency: "USD" } }] });
    expect(p?.offers).toEqual([{ retailer: "unknown.com", price: 25, currency: "USD", url: null, availability: null }]);
    expect(eligibleOffers(p?.offers ?? [], "USD", 100)).toEqual([]);
  });
  it("avoids duplicate offers when Channel3 attribution changes", () => {
    expect(stableOfferIdentity("https://buy.trychannel3.com/a?o=one&aid=first")).toBe(stableOfferIdentity("https://buy.trychannel3.com/a?o=one&aid=second"));
    const duplicate = { ...rawProduct, offers: [rawProduct.offers[0], { ...rawProduct.offers[0], url: "https://buy.trychannel3.com/product?o=one&aid=second" }] };
    expect(normalizeProduct(duplicate)?.offers).toHaveLength(1);
  });
  it("validates natural-language input and positive two-decimal budgets", () => {
    expect(searchProductsSchema.safeParse({ query: "Comfortable headphones for a long flight", mode: "live", budget: 100.25, currency: "USD" }).success).toBe(true);
    for (const budget of [-1, 0, Infinity, 1.001]) expect(searchProductsSchema.safeParse({ query: "headphones", budget }).success).toBe(false);
    expect(searchProductsSchema.safeParse({ query: " " }).success).toBe(false);
    expect(searchProductsSchema.safeParse({ query: "headphones", currency: "INR" }).success).toBe(false);
  });
  it("rejects unsafe product links", () => {
    expect(normalizeProduct({ ...rawProduct, offers: [{ domain: "shop.com", price: { price: 20, currency: "USD" }, url: "javascript:alert(1)", availability: "InStock" }] })?.offers[0]?.url).toBeNull();
  });
  it("applies the approved best-effort limit and resets after its window", () => {
    const allow = createSearchLimiter(2, 60_000);
    expect(allow("shopper", 0)).toBe(true);
    expect(allow("shopper", 1)).toBe(true);
    expect(allow("shopper", 2)).toBe(false);
    expect(allow("shopper", 60_000)).toBe(true);
  });
});