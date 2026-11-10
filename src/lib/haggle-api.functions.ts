// Haggle Bot backend API. Each server function maps to one backend operation and
// returns a structured ApiResult ({ ok: true, data } | { ok: false, error }).
// Public: searchProducts, comparePrices. All others require a signed-in user.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ComparePricesInput,
  CreatePaypalOrderInput,
  NegotiationHistoryInput,
  OrderIdInput,
  ProcessMessageInput,
  SearchProductsInput,
  StartNegotiationInput,
  UserOrdersInput,
} from "./backend/schemas";

const service = () => import("./backend/haggle-service.server");

async function publicCtx() {
  const { createPublicClient } = await import("./backend/clients.server");
  return { db: createPublicClient() };
}

async function authCtx(context: { userId: string; supabase: unknown; claims: unknown }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = (context.claims as { email?: unknown }).email;
  return {
    userId: context.userId,
    email: typeof email === "string" ? email : undefined,
    db: context.supabase as typeof supabaseAdmin,
    admin: supabaseAdmin,
  };
}

/** search-products (public, demo catalog) */
export const searchProducts = createServerFn({ method: "POST" })
  .inputValidator((input: SearchProductsInput) => input)
  .handler(async ({ data }) => (await service()).searchProducts(await publicCtx(), data));

/** compare-prices (public, simulated store prices) */
export const comparePrices = createServerFn({ method: "POST" })
  .inputValidator((input: ComparePricesInput) => input)
  .handler(async ({ data }) => (await service()).comparePrices(await publicCtx(), data));

/** start-negotiation */
export const startNegotiation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StartNegotiationInput) => input)
  .handler(async ({ data, context }) => (await service()).startNegotiation(await authCtx(context), data));

/** process-negotiation-message */
export const processNegotiationMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ProcessMessageInput) => input)
  .handler(async ({ data, context }) =>
    (await service()).processNegotiationMessage(await authCtx(context), data),
  );

/** get-negotiation-history */
export const getNegotiationHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: NegotiationHistoryInput) => input)
  .handler(async ({ data, context }) => (await service()).getNegotiationHistory(await authCtx(context), data));

/** create-paypal-order (returns PAYMENTS_NOT_CONFIGURED until PayPal is connected) */
export const createPaypalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreatePaypalOrderInput) => input)
  .handler(async ({ data, context }) => (await service()).createPaypalOrder(await authCtx(context), data));

/** capture-paypal-order (only the server marks an order paid, after PayPal confirms) */
export const capturePaypalOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OrderIdInput) => input)
  .handler(async ({ data, context }) => (await service()).capturePaypalOrder(await authCtx(context), data));

/** verify-payment */
export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OrderIdInput) => input)
  .handler(async ({ data, context }) => (await service()).verifyPayment(await authCtx(context), data));

/** get-user-orders */
export const getUserOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UserOrdersInput) => input)
  .handler(async ({ data, context }) => (await service()).getUserOrders(await authCtx(context), data));
