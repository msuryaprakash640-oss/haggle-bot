import { z } from "zod";

export const LIVE_CURRENCIES = ["USD", "CAD", "AUD", "GBP", "EUR", "SEK", "CZK", "RON", "CHF", "PLN"] as const;
export type LiveCurrency = typeof LIVE_CURRENCIES[number];
export interface LiveOffer {
  retailer: string;
  price: number;
  currency: string;
  url: string | null;
  availability: string | null;
}
export interface LiveProduct {
  externalId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  description: string | null;
  offers: LiveOffer[];
}
const safeUrl = z.string().url().refine((v) => v.startsWith("https://"));
const priceSchema = z.object({ price: z.number().finite().positive().max(9_999_999_999.99), currency: z.string().regex(/^[A-Z]{3}$/) });
const productSchema = z.object({
  id: z.string().min(1).max(200), title: z.string().min(1).max(1000),
  description: z.string().nullish(),
  brands: z.array(z.object({ name: z.string() })).nullish(),
  images: z.array(z.object({ url: z.string().nullish(), cleaned_url: z.string().nullish(), is_main_image: z.boolean().optional() })).nullish(),
  offers: z.array(z.unknown()).nullish(),
});
const offerSchema = z.object({ domain: z.string().min(1).max(255), price: priceSchema, url: z.string().nullish(), availability: z.string().nullish() });
export const AVAILABILITY: Record<string, string> = { InStock: "in_stock", LimitedAvailability: "limited", OutOfStock: "out_of_stock", PreOrder: "preorder", Preorder: "preorder" };
export const isAvailable = (availability: string | null) => availability === "in_stock" || availability === "limited";
export function normalizeProduct(raw: unknown): LiveProduct | null {
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const images = [...(p.images ?? [])].sort((a, b) => Number(b.is_main_image) - Number(a.is_main_image));
  const imageUrl = images.map((i) => i.cleaned_url || i.url).find((u) => safeUrl.safeParse(u).success) ?? null;
  const offers: LiveOffer[] = [];
  const seen = new Set<string>();
  for (const rawOffer of p.offers ?? []) {
    const parsedOffer = offerSchema.safeParse(rawOffer);
    if (!parsedOffer.success) continue;
    const o = parsedOffer.data;
    const url = safeUrl.safeParse(o.url).success ? o.url ?? null : null;
    const key = `${o.domain}|${o.price.currency}|${stableOfferIdentity(url)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push({ retailer: o.domain, price: Math.round(o.price.price * 100) / 100, currency: o.price.currency, url, availability: o.availability ? AVAILABILITY[o.availability] ?? null : null });
  }
  return { externalId: `channel3:${p.id}`, name: p.title, brand: p.brands?.map((b) => b.name).join(", ") || null, imageUrl, description: p.description ?? null, offers };
}
/** Channel3 attribution changes per request; the offer's `o` reference stays stable. */
export function stableOfferIdentity(url: string | null) {
  if (!url) return "no-url";
  const u = new URL(url);
  const offer = u.searchParams.get("o");
  if (offer) return `${u.hostname}|${offer}`;
  u.searchParams.delete("aid"); u.searchParams.delete("mid"); u.searchParams.delete("user_id");
  return u.toString();
}
export function eligibleOffers(offers: LiveOffer[], currency: string, budget?: number) {
  return offers.filter((o) => o.currency === currency && isAvailable(o.availability) && (budget === undefined || o.price <= budget)).sort((a, b) => a.price - b.price);
}
export function offerSummary(offers: LiveOffer[], currency: string) {
  const available = eligibleOffers(offers, currency);
  const lowest = available[0]?.price ?? null;
  const highest = available.at(-1)?.price ?? null;
  return { lowest, highest, savings: lowest !== null && highest !== null ? Math.round((highest - lowest) * 100) / 100 : 0 };
}
export const formatMoney = (amount: number, currency: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);