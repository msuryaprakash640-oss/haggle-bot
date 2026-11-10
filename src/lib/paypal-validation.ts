import { z } from "zod";

export const PAYPAL_CURRENCIES = ["USD", "CAD", "AUD", "GBP", "EUR", "SEK", "CZK", "CHF", "PLN"] as const;
const amount = z.object({ currency_code: z.string(), value: z.string().regex(/^\d+\.\d{2}$/) });
export const paypalResponseSchema = z.object({
  id: z.string().min(1), status: z.enum(["CREATED", "SAVED", "APPROVED", "VOIDED", "COMPLETED", "PAYER_ACTION_REQUIRED"]),
  purchase_units: z.array(z.object({ reference_id: z.string().optional(), amount: amount.optional(), payments: z.object({ captures: z.array(z.object({ id: z.string().min(1), status: z.string(), amount, final_capture: z.boolean().optional() })).optional() }).optional() })).length(1),
});

export function verifiedCapture(raw: unknown, expected: { providerId: string; referenceId: string; amount: number; currency: string }) {
  const parsed = paypalResponseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.id !== expected.providerId || parsed.data.status !== "COMPLETED") return null;
  const unit = parsed.data.purchase_units[0];
  const captures = unit?.payments?.captures;
  if (!unit || unit.reference_id !== expected.referenceId || captures?.length !== 1) return null;
  const capture = captures[0];
  if (!capture || capture.status !== "COMPLETED" || capture.final_capture !== true || capture.amount.currency_code !== expected.currency || capture.amount.value !== expected.amount.toFixed(2)) return null;
  return capture.id;
}

export function listedCheckoutPrice(offer: { original_price: number; currency: string; availability_status: string }, budget: number) {
  const currency = offer.currency.trim();
  if (!["in_stock", "limited"].includes(offer.availability_status)) throw new Error("This retailer offer is no longer available.");
  if (!PAYPAL_CURRENCIES.some(c => c === currency)) throw new Error("PayPal Sandbox does not support this offer's currency. No currency conversion is applied.");
  if (!Number.isFinite(offer.original_price) || offer.original_price <= 0 || Math.round(offer.original_price * 100) / 100 !== offer.original_price) throw new Error("This offer has an invalid price.");
  if (offer.original_price > budget) throw new Error("The listed retailer price is above your budget. AI targets cannot be used as purchase prices.");
  return { amount: offer.original_price, currency };
}