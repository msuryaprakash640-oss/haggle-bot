import { normalizeProduct, eligibleOffers, type LiveCurrency, type LiveProduct } from "../channel3";
import type { ApiErrorCode } from "../api-result";
import { getRequest } from "@tanstack/react-start/server";
import { createSearchLimiter } from "../search-limit";

const allowSearch = createSearchLimiter();
export class ProductSearchError extends Error {
  constructor(public code: ApiErrorCode, message: string) { super(message); }
}
// Official production OpenAPI: https://api.trychannel3.com/openapi.json
async function channel3(path: string, body?: object): Promise<unknown> {
  const key = process.env["CHANNEL3_API_KEY"];
  if (!key) throw new ProductSearchError("SEARCH_NOT_CONFIGURED", "Live search isn't connected yet. Try the demo instead.");
  const request = getRequest();
  const caller = request.headers.get("cf-connecting-ip") ?? "preview";
  if (!allowSearch(caller)) throw new ProductSearchError("RATE_LIMITED", "Too many searches. Please try again in a minute.");
  let response: Response;
  try {
    response = await fetch(`https://api.trychannel3.com${path}`, { method: body ? "POST" : "GET", headers: { "x-api-key": key, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25_000) });
  } catch {
    throw new ProductSearchError("PROVIDER_ERROR", "Channel3 could not be reached or took too long. Please retry.");
  }
  if (!response.ok) {
    // Never forward/log untrusted error bodies: providers may echo headers or credentials.
    const reason = response.status === 401 || response.status === 403 ? "The Channel3 key or access needs checking."
      : response.status === 429 ? "Channel3's request allowance has been reached. Try later."
      : response.status === 402 ? "Check your Channel3 billing or credits."
      : response.status === 422 ? "Channel3 rejected the search options."
      : response.status === 404 ? "This product is no longer available from Channel3." : "Channel3 is temporarily unavailable.";
    throw new ProductSearchError(response.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR", `Channel3 (${response.status}): ${reason}`);
  }
  try { return await response.json(); }
  catch { throw new ProductSearchError("PROVIDER_ERROR", "Channel3 returned an unreadable response."); }
}

export async function searchExternalProducts(query: string, budget: number | undefined, currency: LiveCurrency): Promise<LiveProduct[]> {
  const raw = await channel3("/v1/search", { query, limit: 20, config: { currency }, filters: { ...(budget === undefined ? {} : { price: { max_price: budget } }), availability: ["InStock", "LimitedAvailability"] } });
  if (!raw || typeof raw !== "object" || !("products" in raw) || !Array.isArray(raw.products)) throw new ProductSearchError("PROVIDER_ERROR", "Channel3 returned an unexpected product list.");
  const products = raw.products.map(normalizeProduct).filter((p): p is LiveProduct => p !== null);
  if (raw.products.length > 0 && products.length === 0) throw new ProductSearchError("PROVIDER_ERROR", "Channel3 returned products with unsupported fields.");
  // Defend the ceiling and currency again locally; do not convert or invent prices.
  return products.filter((p) => eligibleOffers(p.offers, currency, budget).length > 0);
}
export async function getExternalProduct(externalId: string, currency: LiveCurrency) {
  const id = externalId.slice("channel3:".length);
  const raw = await channel3(`/v1/products/${encodeURIComponent(id)}?currency=${encodeURIComponent(currency)}`);
  const product = normalizeProduct(raw);
  if (!product || product.externalId !== externalId) throw new ProductSearchError("PROVIDER_ERROR", "Channel3 returned unexpected product details.");
  return product;
}

export const DEMO_PREFIX = "demo:";
export const isDemoProduct = (externalId: string | null) => !!externalId?.startsWith(DEMO_PREFIX);
