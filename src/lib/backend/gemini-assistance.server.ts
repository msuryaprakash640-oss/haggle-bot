import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { adviceMessage, assistanceSchema } from "../gemini-negotiation";
import { fail, ok } from "../api-result";
import { generateAdvice, GeminiError } from "./gemini.server";

type Db = SupabaseClient<Database>;
type Context = { userId: string; supabase: Db };
const marker = "AI-simulated assistance · No seller contacted.";
function read<T>(result: { data: T; error: unknown }) {
  if (result.error) throw new Error("History storage unavailable");
  return result.data;
}

async function catalog(db: Db, productId: string, currency: string) {
  const product = read(await db.from("products").select("id, product_name, external_product_id").eq("id", productId).maybeSingle());
  if (!product?.external_product_id?.startsWith("channel3:")) return null;
  const offers = read(await db.from("retailer_offers").select("id, retailer_name, original_price, currency, availability_status").eq("product_id", productId).eq("currency", currency).in("availability_status", ["in_stock", "limited"]).order("original_price"));
  if (!offers?.length) return null;
  return { product, offers };
}

export async function assist(ctx: Context, input: unknown) {
  const parsed = assistanceSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Enter a valid product, budget and message (up to 500 characters).");
  const data = parsed.data;
  try {
    const selected = await catalog(ctx.supabase, data.productId, data.currency);
    const best = selected?.offers[0];
    if (!selected || !best) return fail("OUT_OF_STOCK", "No saved available Channel3 prices exist for this product and currency. Compare retailers again.");
    const existing = data.negotiationId ? read(await ctx.supabase.from("negotiations").select("*").eq("id", data.negotiationId).eq("user_id", ctx.userId).maybeSingle()) : null;
    if (data.negotiationId && (!existing || existing.product_id !== data.productId || existing.user_budget !== data.budget || existing.negotiation_status !== "negotiating")) return fail("INVALID_STATE", "This conversation does not match your selected product or budget. Start a new conversation.");
    const history = existing ? (read(await ctx.supabase.from("negotiation_messages").select("*").eq("negotiation_id", existing.id).order("created_at", { ascending: false }).limit(40)) ?? []).reverse() : [];
    if (existing && !history.some(m => m.sender_type === "bot" && m.message.startsWith(marker))) return fail("INVALID_STATE", "This conversation is not a Gemini assistance session.");
    if (existing) {
      const originalOffer = read(await ctx.supabase.from("retailer_offers").select("currency").eq("id", existing.retailer_offer_id ?? "").maybeSingle());
      if (originalOffer?.currency !== data.currency) return fail("INVALID_STATE", "The conversation currency cannot be changed.");
    }
    const advice = await generateAdvice({ product: selected.product.product_name, budget: data.budget, currency: data.currency,
      offers: selected.offers.slice(0, 30).map(o => ({ retailer: o.retailer_name, price: o.original_price })),
      history: history.map(m => ({ role: m.sender_type, message: m.message })), message: data.message, offerAmount: data.offerAmount });
    // Import privileged client only after ownership, trusted catalog and model validation.
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const id = existing?.id ?? crypto.randomUUID();
    if (!existing) {
      read(await admin.from("profiles").upsert({ id: ctx.userId }, { onConflict: "id", ignoreDuplicates: true }));
      read(await admin.from("negotiations").insert({ id, user_id: ctx.userId, product_id: data.productId, retailer_offer_id: best.id, user_budget: data.budget, opening_offer: advice.targetPrice, current_offer: advice.targetPrice, negotiation_status: "negotiating" }));
    } else {
      // Compare-and-set prevents two concurrent turns from overwriting each other.
      const updated = read(await admin.from("negotiations").update({ current_offer: advice.targetPrice }).eq("id", id).eq("user_id", ctx.userId).eq("updated_at", existing.updated_at).select("id").maybeSingle());
      if (!updated) return fail("INVALID_STATE", "Another message updated this conversation. Reload its history and retry.");
    }
    const now = Date.now();
    const saved = await admin.from("negotiation_messages").insert([
      { negotiation_id: id, sender_type: "user", message: data.message, offer_amount: data.offerAmount ?? null, created_at: new Date(now).toISOString() },
      { negotiation_id: id, sender_type: "bot", message: adviceMessage(advice, data.budget, data.currency, data.offerAmount), offer_amount: advice.targetPrice, created_at: new Date(now + 1).toISOString() },
    ]);
    if (saved.error) {
      if (!existing) await admin.from("negotiations").delete().eq("id", id).eq("user_id", ctx.userId);
      else await admin.from("negotiations").update({ current_offer: existing.current_offer }).eq("id", id).eq("user_id", ctx.userId).eq("current_offer", advice.targetPrice);
      return fail("INTERNAL_ERROR", "Your reply could not be saved. Reload history before retrying.");
    }
    const messages = read(await ctx.supabase.from("negotiation_messages").select("id, sender_type, message, offer_amount, created_at").eq("negotiation_id", id).order("created_at")) ?? [];
    return ok({ negotiationId: id, targetPrice: advice.targetPrice, budget: data.budget, currency: data.currency, simulated: true as const, messages });
  } catch (error) {
    if (error instanceof GeminiError) return fail(error.code, error.message);
    // Never log request context, credentials or raw provider errors.
    return fail("INTERNAL_ERROR", "Could not load or save this conversation. Please try again.");
  }
}

export async function assistanceHistory(ctx: Context, input: unknown) {
  const parsed = assistanceSchema.pick({ productId: true, budget: true, currency: true }).safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Choose a product, currency and budget.");
  try {
    const sessions = read(await ctx.supabase.from("negotiations").select("id, created_at, current_offer, retailer_offers(currency), negotiation_messages(id, sender_type, message, offer_amount, created_at)").eq("user_id", ctx.userId).eq("product_id", parsed.data.productId).eq("user_budget", parsed.data.budget).eq("negotiation_status", "negotiating").order("created_at", { ascending: false }).limit(20));
    return ok({ sessions: (sessions ?? []).filter(s => s.retailer_offers?.currency === parsed.data.currency && s.negotiation_messages.some(m => m.message.startsWith(marker))).map(s => ({ id: s.id, createdAt: s.created_at, targetPrice: s.current_offer, messages: [...s.negotiation_messages].sort((a, b) => a.created_at.localeCompare(b.created_at)) })) });
  } catch { return fail("INTERNAL_ERROR", "Your saved conversations could not be loaded. Please retry."); }
}