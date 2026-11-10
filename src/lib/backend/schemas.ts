import { z } from "zod";
import { LIVE_CURRENCIES } from "../channel3";

const uuid = z.string().uuid("Must be a valid id");
const amount = z
  .number({ invalid_type_error: "Must be a number" })
  .finite()
  .positive("Must be greater than zero")
  .max(100_000_000, "Amount is too large")
  .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "At most 2 decimals");

export const searchProductsSchema = z.object({
  query: z.string().trim().min(1, "Enter something to search").max(100),
  mode: z.enum(["demo", "live"]).default("demo"),
  budget: amount.optional(),
  currency: z.enum(LIVE_CURRENCIES).default("USD"),
});

export const comparePricesSchema = z.object({ productId: uuid, currency: z.enum(LIVE_CURRENCIES).default("USD") });

export const startNegotiationSchema = z.object({
  productId: uuid,
  retailerOfferId: uuid,
  budget: amount,
});

export const processMessageSchema = z.object({
  negotiationId: uuid,
  action: z.enum(["counter", "accept_seller_offer", "cancel"]).default("counter"),
  message: z.string().trim().min(1).max(500).optional(),
  offerAmount: amount.optional(),
});

export const negotiationHistorySchema = z.object({
  negotiationId: uuid.optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const createPaypalOrderSchema = z.union([
  z.object({ negotiationId: uuid }),
  z.object({ retailerOfferId: uuid, budget: amount }),
]);
export const orderIdSchema = z.object({ orderId: uuid });
export const userOrdersSchema = z.object({ limit: z.number().int().min(1).max(50).default(20) });

export type SearchProductsInput = z.input<typeof searchProductsSchema>;
export type ComparePricesInput = z.input<typeof comparePricesSchema>;
export type StartNegotiationInput = z.input<typeof startNegotiationSchema>;
export type ProcessMessageInput = z.input<typeof processMessageSchema>;
export type NegotiationHistoryInput = z.input<typeof negotiationHistorySchema>;
export type CreatePaypalOrderInput = z.input<typeof createPaypalOrderSchema>;
export type OrderIdInput = z.input<typeof orderIdSchema>;
export type UserOrdersInput = z.input<typeof userOrdersSchema>;
