import { z } from "zod";
import { LIVE_CURRENCIES, formatMoney } from "./channel3";

const amount = z.number().finite().positive().max(100_000_000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Use at most two decimals.");
export const assistanceSchema = z.object({
  productId: z.string().uuid(),
  currency: z.enum(LIVE_CURRENCIES),
  budget: amount,
  negotiationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(500),
  offerAmount: amount.optional(),
});
export type AssistanceInput = z.infer<typeof assistanceSchema>;
export const geminiAdviceSchema = z.object({
  targetPrice: amount,
  rationale: z.string().trim().min(1).max(1500),
  reply: z.string().trim().min(1).max(2000),
});
export type Advice = z.infer<typeof geminiAdviceSchema>;

/** Generated text is advice, never a verified seller reply or payment instruction. */
export function validateAdvice(raw: unknown, budget: number, lowestPrice: number): Advice {
  const advice = geminiAdviceSchema.parse(raw);
  if (advice.targetPrice > budget || advice.targetPrice > lowestPrice) throw new Error("Unsafe target price");
  const unsupportedClaim = /\b(accept(?:ed|s)|agreed|confirmed|approved|secured|purchased|paid|payment|checkout|paypal)\b/i;
  if (unsupportedClaim.test(`${advice.reply} ${advice.rationale}`)) throw new Error("Unverified transaction claim");
  return advice;
}

export function adviceMessage(advice: Advice, budget: number, currency: string, offer?: number) {
  const f = (n: number) => formatMoney(n, currency);
  const budgetExplanation = offer === undefined ? "" : offer <= budget
    ? `Your proposed offer of ${f(offer)} is within your ${f(budget)} budget.`
    : `The offer of ${f(offer)} is ${f(Math.round((offer - budget) * 100) / 100)} above your ${f(budget)} budget. Do not raise your limit.`;
  return `AI-simulated assistance · No seller contacted.\n\nSuggested target: ${f(advice.targetPrice)} — within your ${f(budget)} budget.\n${budgetExplanation}\n\n${advice.rationale}\n\n${advice.reply}\n\nThis is a draft, not a seller commitment. Nothing has been purchased.`;
}