import type { LiveProduct } from "../channel3";
import { channel3OfferId } from "../channel3-offer-id";
import { ProductSearchError } from "../integrations/product-search.server";
/** Only called with normalized responses from the fixed Channel3 host, never caller-supplied rows. */
export async function saveChannel3Product(product: LiveProduct, currency: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  try {
    const saved = await db.from("products").upsert({ external_product_id: product.externalId, product_name: product.name, brand: product.brand, image_url: product.imageUrl, description: product.description }, { onConflict: "external_product_id" }).select("id").single();
    if (saved.error || !saved.data) throw new Error("product write failed");
    const id = saved.data.id;
    const offers = await Promise.all(product.offers.filter((o) => o.currency === currency && o.availability !== null).map(async (o) => ({
      id: await channel3OfferId(product.externalId, o),
      product_id: id, retailer_name: o.retailer, original_price: o.price, currency: o.currency, product_url: o.url, availability_status: o.availability ?? "out_of_stock",
    })));
    // Retire stale snapshots without deleting offer rows referenced by negotiations.
    const previous = await db.from("retailer_offers").select("id").eq("product_id", id).eq("currency", currency);
    if (previous.error) throw new Error("offer read failed");
    const currentIds = new Set(offers.map((o) => o.id));
    const staleIds = (previous.data ?? []).filter((o) => !currentIds.has(o.id)).map((o) => o.id);
    if (staleIds.length) {
      const retired = await db.from("retailer_offers").update({ availability_status: "out_of_stock" }).in("id", staleIds);
      if (retired.error) throw new Error("offer retirement failed");
    }
    if (offers.length) {
      const result = await db.from("retailer_offers").upsert(offers, { onConflict: "id" });
      if (result.error) throw new Error("offer write failed");
    }
    return id;
  } catch {
    throw new ProductSearchError("CATALOG_SAVE_FAILED", "Live products were found, but the catalog could not be updated. Please try again.");
  }
}