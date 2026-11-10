// Server-side implementation of every Haggle Bot backend operation.
// - Public operations (search, compare) read the demo catalog with RLS as anon.
// - Private operations read as the signed-in user (RLS) and write through the
//   service-role client only after the server has checked ownership, prices and budget.
// - Seller replies are simulated. Payments are never faked: until a payment provider
//   is connected, payment operations return PAYMENTS_NOT_CONFIGURED.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "../../integrations/supabase/types";
import { fail, ok, type ApiResult } from "../api-result";
import { formatINR } from "../haggle";
import { listedCheckoutPrice, verifiedCapture } from "../paypal-validation";
import { getPaymentProvider, type ProviderOrder } from "../integrations/paypal.server";
import { isDemoProduct, searchExternalProducts, getExternalProduct, ProductSearchError } from "../integrations/product-search.server";
import { saveChannel3Product } from "./channel3-catalog.server";
import { channel3OfferId } from "../channel3-offer-id";
import { eligibleOffers, isAvailable, offerSummary } from "../channel3";
import {
  money,
  nextBotOffer,
  openingOffer,
  sellerFloor,
  sellerRespond,
  type SellerDecision,
} from "../negotiation-engine";
import {
  comparePricesSchema,
  createPaypalOrderSchema,
  negotiationHistorySchema,
  orderIdSchema,
  processMessageSchema,
  searchProductsSchema,
  startNegotiationSchema,
  userOrdersSchema,
} from "./schemas";

type Db = SupabaseClient<Database>;
type Tables = Database["public"]["Tables"];
type NegotiationRow = Tables["negotiations"]["Row"];
type MessageRow = Tables["negotiation_messages"]["Row"];
type OrderRow = Tables["orders"]["Row"];
type MessageInsert = Tables["negotiation_messages"]["Insert"];
type NegotiationStatus = "negotiating" | "deal_found" | "no_deal" | "cancelled" | "approved";

export interface PublicCtx {
  db: Db;
}
export interface AuthCtx {
  userId: string;
  email?: string | undefined;
  /** Client acting as the signed-in user; RLS applies. */
  db: Db;
  /** Service-role client; used for writes only after server-side checks. */
  admin: Db;
}

// ---------- helpers ----------

function parse<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
): { ok: true; data: z.output<S> } | { ok: false; res: ApiResult<never> } {
  const r = schema.safeParse(input ?? {});
  if (r.success) return { ok: true, data: r.data };
  const fieldErrors = r.error.flatten().fieldErrors as Record<string, string[]>;
  return { ok: false, res: fail("VALIDATION_ERROR", "Some fields are invalid.", fieldErrors) };
}

async function guard<T>(op: string, fn: () => Promise<ApiResult<T>>): Promise<ApiResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ProductSearchError) return fail(e.code, e.message);
    console.error(`[haggle:${op}]`, e);
    return fail("INTERNAL_ERROR", "Something went wrong on our side. Please try again.");
  }
}

/** For queries that may legitimately return no row. */
type DbResponse = { data: unknown; error: { message: string } | null };

function maybe<R extends DbResponse>(res: R, what: string): NonNullable<R["data"]> | null {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? null) as NonNullable<R["data"]> | null;
}

/** For queries that must return data. */
function must<R extends DbResponse>(res: R, what: string): NonNullable<R["data"]> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  if (res.data == null) throw new Error(`${what}: no data returned`);
  return res.data as NonNullable<R["data"]>;
}

const SYNONYMS: Record<string, string[]> = {
  phone: ["iphone"],
  mobile: ["iphone"],
  smartphone: ["iphone"],
  laptop: ["macbook"],
  notebook: ["macbook"],
  shoe: ["sneakers"],
  shoes: ["sneakers"],
  running: ["sneakers"],
  earphones: ["headphones"],
  earbuds: ["headphones"],
  audio: ["headphones"],
};

function searchTokens(query: string): string[] {
  const base = query
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  const all = new Set<string>();
  for (const t of base.slice(0, 6)) {
    all.add(t);
    for (const s of SYNONYMS[t] ?? []) all.add(s);
  }
  return [...all].slice(0, 10);
}

function messageDto(m: MessageRow) {
  return {
    id: m.id,
    sender: m.sender_type as "user" | "bot" | "seller",
    message: m.message,
    offerAmount: m.offer_amount,
    simulated: m.sender_type === "seller",
    createdAt: m.created_at,
  };
}

function negotiationDto(n: NegotiationRow) {
  return {
    id: n.id,
    productId: n.product_id,
    retailerOfferId: n.retailer_offer_id,
    budget: n.user_budget,
    openingOffer: n.opening_offer,
    currentOffer: n.current_offer,
    status: n.negotiation_status,
    /** Agreed price, only when a deal within budget was found. */
    agreedPrice: n.negotiation_status === "deal_found" || n.negotiation_status === "approved" ? n.current_offer : null,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  };
}

function orderDto(o: OrderRow) {
  return {
    id: o.id,
    negotiationId: o.negotiation_id,
    originalPrice: o.original_price,
    approvedPrice: o.approved_price,
    savings: money(o.original_price - o.approved_price),
    currency: o.currency,
    paymentStatus: o.payment_status,
    hasProviderOrder: !!o.paypal_order_id,
    paypalOrderId: o.paypal_order_id,
    transactionId: o.paypal_capture_id,
    createdAt: o.created_at,
  };
}

/** Builds message rows with strictly increasing timestamps so chat order is stable. */
function buildMessages(negotiationId: string, items: Array<Omit<MessageInsert, "negotiation_id">>): MessageInsert[] {
  const base = Date.now();
  return items.map((m, i) => ({ ...m, negotiation_id: negotiationId, created_at: new Date(base + i).toISOString() }));
}

/** Seller + bot lines for a seller decision, and the resulting negotiation state. */
function describeDecision(d: SellerDecision, listPrice: number, budget: number) {
  const f = formatINR;
  const lines: Array<Omit<MessageInsert, "negotiation_id">> = [];
  let status: NegotiationStatus = "negotiating";
  let agreed: number | null = null;
  if (d.kind === "accept") {
    lines.push({ sender_type: "seller", message: `You drive a hard bargain — ${f(d.price)} it is!`, offer_amount: d.price });
    lines.push({
      sender_type: "bot",
      message: `Deal found at ${f(d.price)}, within your budget — you save ${f(listPrice - d.price)}. Review and approve it to continue.`,
    });
    status = "deal_found";
    agreed = d.price;
  } else if (d.kind === "counter") {
    lines.push({
      sender_type: "seller",
      message: d.round === 1 ? `We can offer ${f(d.price)}.` : `Hmm… we could stretch to ${f(d.price)}.`,
      offer_amount: d.price,
    });
  } else {
    lines.push({ sender_type: "seller", message: `Our best simulated offer is ${f(d.price)}.`, offer_amount: d.price });
    if (d.withinBudget) {
      lines.push({
        sender_type: "bot",
        message: `${f(d.price)} is within your budget — you save ${f(listPrice - d.price)}. Review and approve it to continue.`,
      });
      status = "deal_found";
      agreed = d.price;
    } else {
      lines.push({
        sender_type: "bot",
        message: `${f(d.price)} is ${f(d.price - budget)} above your limit. I won't cross your budget, so no deal this time.`,
      });
      status = "no_deal";
    }
  }
  return { lines, status, agreed };
}

// ---------- public operations ----------

export function searchProducts(ctx: PublicCtx, input: unknown) {
  return guard<{ query: string; source: "live" | "demo"; results: Array<{ id: string; name: string; brand: string | null; imageUrl: string | null; description: string | null; isDemo: boolean; offerCount: number; lowestPrice: number | null; currency: string }> }>("search-products", async () => {
    const p = parse(searchProductsSchema, input);
    if (!p.ok) return p.res;
    const { query, mode, budget, currency } = p.data;
    if (mode === "live") {
      const external = await searchExternalProducts(query, budget, currency);
      const results = [];
      for (const product of external) {
        const id = await saveChannel3Product(product, currency);
        const offers = eligibleOffers(product.offers, currency, budget);
        results.push({ id, name: product.name, brand: product.brand, imageUrl: product.imageUrl, description: product.description, isDemo: false, offerCount: offers.length, lowestPrice: offers[0]?.price ?? null, currency });
      }
      return ok({ query, source: "live" as const, results });
    }

    const tokens = searchTokens(query);
    if (tokens.length === 0) return ok({ query, source: "demo" as const, results: [] });
    const filter = tokens.flatMap((t) => [`product_name.ilike.%${t}%`, `brand.ilike.%${t}%`]).join(",");
    const rows = must(
      await ctx.db
        .from("products")
        .select(
          "id, external_product_id, product_name, brand, image_url, description, retailer_offers(original_price, currency, availability_status)",
        )
        .or(filter)
        .like("external_product_id", "demo:%")
        .limit(20),
      "search products",
    );

    const results = rows
      .map((r) => {
        const hay = `${r.product_name} ${r.brand ?? ""}`.toLowerCase();
        const score = tokens.filter((t) => hay.includes(t)).length;
        const available = r.retailer_offers.filter((o) => o.availability_status !== "out_of_stock");
        const lowest = available.length ? Math.min(...available.map((o) => o.original_price)) : null;
        return {
          id: r.id,
          name: r.product_name,
          brand: r.brand,
          imageUrl: r.image_url,
          description: r.description,
          isDemo: isDemoProduct(r.external_product_id),
          offerCount: r.retailer_offers.length,
          lowestPrice: lowest,
          currency: r.retailer_offers[0]?.currency ?? "INR",
          score,
        };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map(({ score: _s, ...rest }) => rest)
      .filter((r) => budget === undefined || (r.lowestPrice !== null && r.lowestPrice <= budget));

    return ok({ query, source: "demo" as const, results });
  });
}

export function comparePrices(ctx: PublicCtx, input: unknown) {
  return guard("compare-prices", async () => {
    const p = parse(comparePricesSchema, input);
    if (!p.ok) return p.res;
    const product = maybe(
      await ctx.db
        .from("products")
        .select(
          "id, external_product_id, product_name, brand, image_url, retailer_offers(id, retailer_name, original_price, currency, product_url, availability_status)",
        )
        .eq("id", p.data.productId)
        .maybeSingle(),
      "load product",
    );
    if (!product) return fail("NOT_FOUND", "Product not found.");

    if (product.external_product_id?.startsWith("channel3:")) {
      const live = await getExternalProduct(product.external_product_id, p.data.currency);
      await saveChannel3Product(live, p.data.currency);
      // Saved offers (known availability) use their stored UUID so checkout can load the trusted row.
      const offers = await Promise.all(live.offers.filter((o) => o.currency === p.data.currency).sort((a, b) => a.price - b.price).map(async (o, i) => ({ ...o, id: o.availability !== null ? await channel3OfferId(live.externalId, o) : `${live.externalId}:unsaved:${i}`, simulated: false })));
      const summary = offerSummary(live.offers, p.data.currency);
      const best = offers.find((o) => isAvailable(o.availability));
      return ok({ product: { id: product.id, name: live.name, brand: live.brand, imageUrl: live.imageUrl, isDemo: false }, offers, bestOfferId: best?.id ?? null, lowestPrice: summary.lowest, highestPrice: summary.highest, potentialSavings: summary.savings });
    }

    const offers = [...product.retailer_offers]
      .sort((a, b) => a.original_price - b.original_price)
      .map((o) => ({
        id: o.id,
        retailer: o.retailer_name,
        price: o.original_price,
        currency: o.currency,
        url: o.product_url,
        availability: o.availability_status,
        simulated: isDemoProduct(product.external_product_id),
      }));
    const available = offers.filter((o) => o.availability !== "out_of_stock");
    const best = available[0] ?? null;
    const highest = available.at(-1)?.price ?? null;

    return ok({
      product: {
        id: product.id,
        name: product.product_name,
        brand: product.brand,
        imageUrl: product.image_url,
        isDemo: isDemoProduct(product.external_product_id),
      },
      offers,
      bestOfferId: best?.id ?? null,
      lowestPrice: best?.price ?? null,
      highestPrice: highest,
      potentialSavings: best && highest !== null ? money(highest - best.price) : 0,
    });
  });
}

// ---------- private operations ----------

async function ensureProfile(ctx: AuthCtx) {
  maybe(
    await ctx.admin
      .from("profiles")
      .upsert({ id: ctx.userId, email: ctx.email ?? null }, { onConflict: "id", ignoreDuplicates: true }),
    "ensure profile",
  );
}

export function startNegotiation(ctx: AuthCtx, input: unknown) {
  return guard("start-negotiation", async () => {
    const p = parse(startNegotiationSchema, input);
    if (!p.ok) return p.res;
    const { productId, retailerOfferId, budget } = p.data;

    const offer = maybe(
      await ctx.db
        .from("retailer_offers")
        .select("id, product_id, retailer_name, original_price, currency, availability_status, products(product_name)")
        .eq("id", retailerOfferId)
        .maybeSingle(),
      "load offer",
    );
    if (!offer || offer.product_id !== productId || !offer.products) return fail("NOT_FOUND", "That store offer was not found.");
    if (offer.availability_status === "out_of_stock") return fail("OUT_OF_STOCK", `${offer.retailer_name} is out of stock.`);

    await ensureProfile(ctx);

    const listPrice = offer.original_price;
    const id = crypto.randomUUID();
    const floor = sellerFloor(listPrice, id);
    const opening = openingOffer(listPrice, budget);
    const decision = sellerRespond({ listPrice, floor, budget, botOffer: opening, round: 1 });
    const outcome = describeDecision(decision, listPrice, budget);
    const name = offer.products.product_name;

    const negotiation = must(
      await ctx.admin
        .from("negotiations")
        .insert({
          id,
          user_id: ctx.userId,
          product_id: productId,
          retailer_offer_id: offer.id,
          user_budget: budget,
          opening_offer: opening,
          current_offer: outcome.agreed ?? opening,
          negotiation_status: outcome.status,
        })
        .select("*")
        .single(),
      "create negotiation",
    );

    const messages = must(
      await ctx.admin
        .from("negotiation_messages")
        .insert(
          buildMessages(id, [
            { sender_type: "user", message: `I want ${name} under ${formatINR(budget)}.`, offer_amount: budget },
            {
              sender_type: "bot",
              message: `I found an offer at ${formatINR(listPrice)} from ${offer.retailer_name}. Let's try negotiating for ${formatINR(opening)}.`,
              offer_amount: opening,
            },
            ...outcome.lines,
          ]),
        )
        .select("*")
        .order("created_at"),
      "save messages",
    );

    return ok({
      negotiation: negotiationDto(negotiation),
      retailer: offer.retailer_name,
      listPrice,
      currency: offer.currency,
      messages: messages.map(messageDto),
    });
  });
}

export function processNegotiationMessage(ctx: AuthCtx, input: unknown) {
  return guard("process-negotiation-message", async () => {
    const p = parse(processMessageSchema, input);
    if (!p.ok) return p.res;
    const { negotiationId, action, message, offerAmount } = p.data;

    const n = maybe(
      await ctx.db.from("negotiations").select("*").eq("id", negotiationId).maybeSingle(),
      "load negotiation",
    );
    if (!n) return fail("NOT_FOUND", "Negotiation not found.");
    if (n.negotiation_status !== "negotiating")
      return fail("NEGOTIATION_CLOSED", `This negotiation is already ${n.negotiation_status.replace("_", " ")}.`);
    if (!n.retailer_offer_id) return fail("INVALID_STATE", "This negotiation has no store offer attached.");

    const offer = maybe(
      await ctx.db.from("retailer_offers").select("original_price").eq("id", n.retailer_offer_id).maybeSingle(),
      "load offer",
    );
    if (!offer) return fail("INVALID_STATE", "The store offer for this negotiation is no longer available.");

    const sellerMsgs = must(
      await ctx.db
        .from("negotiation_messages")
        .select("offer_amount")
        .eq("negotiation_id", n.id)
        .eq("sender_type", "seller")
        .order("created_at", { ascending: false }),
      "load seller messages",
    );
    const lastCounter = sellerMsgs[0]?.offer_amount;
    if (lastCounter == null) return fail("INVALID_STATE", "Waiting for the seller's first reply.");

    const budget = n.user_budget;
    const listPrice = offer.original_price;
    const lastBot = n.current_offer ?? n.opening_offer ?? openingOffer(listPrice, budget);
    const userLine: Array<Omit<MessageInsert, "negotiation_id">> = message
      ? [{ sender_type: "user", message, offer_amount: offerAmount ?? null }]
      : [];

    let lines: Array<Omit<MessageInsert, "negotiation_id">>;
    let status: NegotiationStatus;
    let current: number;

    if (action === "cancel") {
      lines = [...userLine, { sender_type: "bot", message: "Negotiation cancelled. Nothing was purchased." }];
      status = "cancelled";
      current = lastBot;
    } else if (action === "accept_seller_offer") {
      if (lastCounter > budget)
        return fail(
          "OVER_BUDGET",
          `The seller's offer of ${formatINR(lastCounter)} is above your budget of ${formatINR(budget)}.`,
        );
      lines = [
        ...(userLine.length ? userLine : [{ sender_type: "user" as const, message: `I'll take ${formatINR(lastCounter)}.` }]),
        {
          sender_type: "bot",
          message: `Deal found at ${formatINR(lastCounter)}, within your budget — you save ${formatINR(listPrice - lastCounter)}. Review and approve it to continue.`,
        },
      ];
      status = "deal_found";
      current = lastCounter;
    } else {
      if (offerAmount !== undefined && offerAmount > budget)
        return fail("OVER_BUDGET", `${formatINR(offerAmount)} is above your budget of ${formatINR(budget)}.`);
      const botOffer = money(
        offerAmount !== undefined ? Math.min(offerAmount, lastCounter) : nextBotOffer({ lastBotOffer: lastBot, lastCounter, budget }),
      );
      const decision = sellerRespond({
        listPrice,
        floor: sellerFloor(listPrice, n.id),
        budget,
        botOffer,
        round: sellerMsgs.length + 1,
      });
      const outcome = describeDecision(decision, listPrice, budget);
      lines = [
        ...(userLine.length
          ? userLine
          : offerAmount !== undefined
            ? [{ sender_type: "user" as const, message: `Offer ${formatINR(offerAmount)}.`, offer_amount: offerAmount }]
            : []),
        { sender_type: "bot", message: `Still pushing for you. Meet me at ${formatINR(botOffer)}?`, offer_amount: botOffer },
        ...outcome.lines,
      ];
      status = outcome.status;
      current = outcome.agreed ?? botOffer;
    }

    if (current > budget && status === "deal_found") throw new Error("Invariant: deal above budget");

    const updated = maybe(
      await ctx.admin
        .from("negotiations")
        .update({ negotiation_status: status, current_offer: current })
        .eq("id", n.id)
        .eq("user_id", ctx.userId)
        .eq("negotiation_status", "negotiating")
        .select("*")
        .maybeSingle(),
      "update negotiation",
    );
    if (!updated) return fail("NEGOTIATION_CLOSED", "This negotiation was updated elsewhere. Refresh and try again.");

    const saved = must(
      await ctx.admin.from("negotiation_messages").insert(buildMessages(n.id, lines)).select("*").order("created_at"),
      "save messages",
    );

    return ok({ negotiation: negotiationDto(updated), messages: saved.map(messageDto) });
  });
}

export function getNegotiationHistory(ctx: AuthCtx, input: unknown) {
  return guard("get-negotiation-history", async () => {
    const p = parse(negotiationHistorySchema, input);
    if (!p.ok) return p.res;
    const { negotiationId, limit } = p.data;
    const select = "*, products(product_name, brand), retailer_offers(retailer_name, original_price, currency)";

    if (negotiationId) {
      const n = maybe(
        await ctx.db.from("negotiations").select(select).eq("id", negotiationId).maybeSingle(),
        "load negotiation",
      );
      if (!n) return fail("NOT_FOUND", "Negotiation not found.");
      const messages = must(
        await ctx.db.from("negotiation_messages").select("*").eq("negotiation_id", n.id).order("created_at"),
        "load messages",
      );
      return ok({
        negotiations: [
          {
            ...negotiationDto(n),
            productName: n.products?.product_name ?? null,
            retailer: n.retailer_offers?.retailer_name ?? null,
            listPrice: n.retailer_offers?.original_price ?? null,
            messages: messages.map(messageDto),
          },
        ],
      });
    }

    const rows = must(
      await ctx.db.from("negotiations").select(select).order("created_at", { ascending: false }).limit(limit),
      "list negotiations",
    );
    return ok({
      negotiations: rows.map((n) => ({
        ...negotiationDto(n),
        productName: n.products?.product_name ?? null,
        retailer: n.retailer_offers?.retailer_name ?? null,
        listPrice: n.retailer_offers?.original_price ?? null,
        messages: [] as ReturnType<typeof messageDto>[],
      })),
    });
  });
}

const NOT_CONFIGURED_MSG =
  "PayPal checkout isn't connected yet. No order was created and nothing was charged.";

function captureId(po: ProviderOrder, order: OrderRow) {
  return verifiedCapture(po.raw, { providerId: order.paypal_order_id ?? "", referenceId: order.id, amount: order.approved_price, currency: order.currency.trim() });
}

export function createPaypalOrder(ctx: AuthCtx, input: unknown) {
  return guard("create-paypal-order", async () => {
    const p = parse(createPaypalOrderSchema, input);
    if (!p.ok) return p.res;
    const provider = getPaymentProvider();
    if (!provider) return fail("PAYMENTS_NOT_CONFIGURED", NOT_CONFIGURED_MSG);
    let negotiationId: string;
    let offerId: string;
    let budget: number;
    if ("negotiationId" in p.data) {
      const n = maybe(await ctx.db.from("negotiations").select("*").eq("id", p.data.negotiationId).eq("user_id", ctx.userId).maybeSingle(), "load negotiation");
      if (!n || !n.retailer_offer_id) return fail("NOT_FOUND", "Negotiation not found.");
      if (n.negotiation_status === "cancelled" || n.negotiation_status === "rejected") return fail("INVALID_STATE", "This negotiation is closed.");
      negotiationId = n.id; offerId = n.retailer_offer_id; budget = n.user_budget;
    } else {
      offerId = p.data.retailerOfferId; budget = p.data.budget;
      negotiationId = "";
    }
    const offer = maybe(await ctx.db.from("retailer_offers").select("*, products(product_name, external_product_id)").eq("id", offerId).maybeSingle(), "load listed offer");
    if (!offer || !offer.products?.external_product_id?.startsWith("channel3:")) return fail("INVALID_STATE", "Only verified live retailer offers can be used for Sandbox checkout. Demo deals and AI targets are not purchase prices.");
    let price: { amount: number; currency: string };
    try { price = listedCheckoutPrice(offer, budget); } catch (e) { return fail("VALIDATION_ERROR", e instanceof Error ? e.message : "Invalid offer."); }
    if (!negotiationId) {
      // A separate checkout record never alters a Gemini advice conversation.
      const n = must(await ctx.admin.from("negotiations").insert({ user_id: ctx.userId, product_id: offer.product_id, retailer_offer_id: offer.id, user_budget: budget, negotiation_status: "comparing" }).select("id").single(), "create checkout record");
      negotiationId = n.id;
    }
    let order = maybe(await ctx.db.from("orders").select("*").eq("negotiation_id", negotiationId).eq("user_id", ctx.userId).maybeSingle(), "load order");
    if (order?.payment_status === "paid") return ok({ order: orderDto(order), approveUrl: null });
    if (order && order.payment_status !== "pending") return fail("INVALID_STATE", "This checkout is closed.");
    if (!order) {
      const inserted = await ctx.admin.from("orders").insert({ user_id: ctx.userId, negotiation_id: negotiationId, original_price: price.amount, approved_price: price.amount, currency: price.currency, payment_status: "pending" }).select("*").single();
      if (inserted.error?.code === "23505") order = maybe(await ctx.db.from("orders").select("*").eq("negotiation_id", negotiationId).eq("user_id", ctx.userId).maybeSingle(), "load concurrent order");
      else order = must(inserted, "create order");
    }
    if (!order) return fail("INVALID_STATE", "Please retry checkout.");
    if (order.approved_price !== price.amount || order.currency.trim() !== price.currency) return fail("INVALID_STATE", "The retailer price changed. Start a new checkout.");
    if (order.paypal_order_id) return ok({ order: orderDto(order), approveUrl: null });
    const po = await provider.createOrder({ referenceId: order.id, amount: price.amount, currency: price.currency, description: offer.products.product_name });
    const saved = must(await ctx.admin.from("orders").update({ paypal_order_id: po.id }).eq("id", order.id).eq("user_id", ctx.userId).eq("payment_status", "pending").select("*").single(), "save provider order");
    return ok({ order: orderDto(saved), approveUrl: null });
  });
}

async function saveVerifiedCapture(ctx: AuthCtx, order: OrderRow, po: ProviderOrder) {
  const transactionId = captureId(po, order);
  if (!transactionId) return null;
  const n = maybe(await ctx.db.from("negotiations").select("user_budget, products(external_product_id), retailer_offers(original_price, currency, availability_status)").eq("id", order.negotiation_id).eq("user_id", ctx.userId).maybeSingle(), "verify stored checkout price");
  if (!n?.retailer_offers || !n.products?.external_product_id?.startsWith("channel3:")) return null;
  // Also protect read-back verification and capture retries from legacy simulated orders.
  let price: { amount: number; currency: string };
  try { price = listedCheckoutPrice(n.retailer_offers, n.user_budget); } catch { return null; }
  if (price.amount !== order.approved_price || price.currency !== order.currency.trim()) return null;
  const saved = maybe(await ctx.admin.from("orders").update({ payment_status: "paid", paypal_capture_id: transactionId }).eq("id", order.id).eq("user_id", ctx.userId).eq("payment_status", "pending").select("*").maybeSingle(), "mark verified payment");
  return saved ?? maybe(await ctx.db.from("orders").select("*").eq("id", order.id).eq("user_id", ctx.userId).eq("payment_status", "paid").maybeSingle(), "load verified order");
}

export function capturePaypalOrder(ctx: AuthCtx, input: unknown) {
  return guard("capture-paypal-order", async () => {
    const p = parse(orderIdSchema, input);
    if (!p.ok) return p.res;
    const order = maybe(await ctx.db.from("orders").select("*").eq("id", p.data.orderId).eq("user_id", ctx.userId).maybeSingle(), "load order");
    if (!order) return fail("NOT_FOUND", "Order not found.");
    if (order.payment_status === "paid") return ok({ order: orderDto(order), alreadyPaid: true });
    if (order.payment_status !== "pending" || !order.paypal_order_id) return fail("INVALID_STATE", "This checkout cannot be captured.");
    const provider = getPaymentProvider();
    if (!provider) return fail("PAYMENTS_NOT_CONFIGURED", NOT_CONFIGURED_MSG);
    let po = await provider.getOrder(order.paypal_order_id);
    if (po.status !== "COMPLETED") {
      if (po.status !== "APPROVED") return fail("INVALID_STATE", "Approve the payment in PayPal before capture.");
      // Revalidate trusted stored price before any capture, including legacy orders.
      const n = maybe(await ctx.db.from("negotiations").select("retailer_offers(original_price, currency, availability_status), user_budget").eq("id", order.negotiation_id).eq("user_id", ctx.userId).maybeSingle(), "load checkout offer");
      if (!n?.retailer_offers) return fail("INVALID_STATE", "Retailer offer missing.");
      const price = listedCheckoutPrice(n.retailer_offers, n.user_budget);
      if (price.amount !== order.approved_price || price.currency !== order.currency.trim()) return fail("PAYMENT_VERIFICATION_FAILED", "The listed price changed or this is a simulated price. Nothing was captured.");
      // Stable per-order idempotency key makes concurrent and retried captures the same operation.
      po = await provider.captureOrder(order.paypal_order_id, order.id);
    }
    const saved = await saveVerifiedCapture(ctx, order, po);
    if (!saved) return fail("PAYMENT_VERIFICATION_FAILED", "PayPal did not confirm the exact payment. Nothing was marked paid.");
    return ok({ order: orderDto(saved), alreadyPaid: false });
  });
}

export function verifyPayment(ctx: AuthCtx, input: unknown) {
  return guard("verify-payment", async () => {
    const p = parse(orderIdSchema, input);
    if (!p.ok) return p.res;
    const order = maybe(await ctx.db.from("orders").select("*").eq("id", p.data.orderId).eq("user_id", ctx.userId).maybeSingle(), "load order");
    if (!order) return fail("NOT_FOUND", "Order not found.");
    const provider = getPaymentProvider();
    if (!provider || !order.paypal_order_id) return ok({ order: orderDto(order), verifiedWithProvider: false, providerStatus: null as string | null, reason: NOT_CONFIGURED_MSG as string | null });
    const po = await provider.getOrder(order.paypal_order_id);
    const verified = captureId(po, order);
    const current = order.payment_status === "pending" && verified ? await saveVerifiedCapture(ctx, order, po) ?? order : order;
    return ok({ order: orderDto(current), verifiedWithProvider: !!verified, providerStatus: po.status as string | null, reason: verified ? null : "No matching completed capture was verified." as string | null });
  });
}

export function getUserOrders(ctx: AuthCtx, input: unknown) {
  return guard("get-user-orders", async () => {
    const p = parse(userOrdersSchema, input);
    if (!p.ok) return p.res;
    const rows = must(
      await ctx.db
        .from("orders")
        .select("*, negotiations(product_id, products(product_name), retailer_offers(retailer_name))")
        .eq("user_id", ctx.userId)
        .order("created_at", { ascending: false })
        .limit(p.data.limit),
      "list orders",
    );
    return ok({
      orders: rows.map((o) => ({
        ...orderDto(o),
        productName: o.negotiations?.products?.product_name ?? null,
        retailer: o.negotiations?.retailer_offers?.retailer_name ?? null,
      })),
    });
  });
}
