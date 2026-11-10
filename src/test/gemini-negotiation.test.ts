import { afterEach, describe, expect, it, vi } from "vitest";
import { adviceMessage, assistanceSchema, validateAdvice } from "@/lib/gemini-negotiation";
import { generateAdvice } from "@/lib/backend/gemini.server";

const advice = { targetPrice: 80, rationale: "The lowest retailer price is 100; a 20% discount is uncertain.", reply: "Could you consider 80 for this product, please?" };
const context = { product: "Headphones", currency: "USD", budget: 90, offers: [{ retailer: "Store", price: 100 }], history: [], message: "Can you suggest a counteroffer?" };
afterEach(() => vi.unstubAllEnvs());
describe("Gemini assistance safeguards", () => {
  it("rejects a target above the user's maximum budget", () => expect(() => validateAdvice({ ...advice, targetPrice: 91 }, 90, 100)).toThrow());
  it("rejects a target above the available retailer price", () => expect(() => validateAdvice({ ...advice, targetPrice: 101 }, 120, 100)).toThrow());
  it("rejects claims that a real seller accepted an offer", () => expect(() => validateAdvice({ ...advice, reply: "The seller accepted 80." }, 90, 100)).toThrow());
  it("rejects automatic payment instructions", () => expect(() => validateAdvice({ ...advice, reply: "Start PayPal payment now." }, 90, 100)).toThrow());
  it("analyses rather than endorses over-budget user offers", () => expect(adviceMessage(advice, 90, "USD", 110)).toContain("$20.00 above your $90.00 budget"));
  it("labels advice as simulated and no seller contacted", () => expect(adviceMessage(advice, 90, "USD")).toContain("AI-simulated assistance · No seller contacted."));
  it("validates positive two-decimal budgets and bounded messages", () => {
    const valid = { productId: "11111111-1111-4111-8111-111111111111", budget: 90, currency: "USD", message: "Help" };
    expect(assistanceSchema.safeParse(valid).success).toBe(true);
    expect(assistanceSchema.safeParse({ ...valid, budget: 0 }).success).toBe(false);
    expect(assistanceSchema.safeParse({ ...valid, budget: 90.001 }).success).toBe(false);
    expect(assistanceSchema.safeParse({ ...valid, message: "a".repeat(501) }).success).toBe(false);
  });
});
describe("Gemini provider handling", () => {
  it("returns validated advice from structured JSON", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-real-key");
    const response = { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(advice) }] } }] };
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(response)));
    expect(await generateAdvice(context, request)).toEqual(advice);
    const body = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
    expect(body.contents[0].parts[0].text).toContain('"budget":90');
    expect(body.contents[0].parts[0].text).toContain('"price":100');
  });
  it("handles missing configuration without calling the provider", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const request = vi.fn<typeof fetch>();
    await expect(generateAdvice(context, request)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(request).not.toHaveBeenCalled();
  });
  it("handles Gemini quota limits", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-real-key");
    await expect(generateAdvice(context, vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 429 })))).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
  it("handles blocked or incomplete Gemini responses", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-real-key");
    await expect(generateAdvice(context, vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: "SAFETY" }] }))))).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });
  it("handles network failure without leaking its details", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-real-key");
    await expect(generateAdvice(context, vi.fn<typeof fetch>().mockRejectedValue(new Error("private provider details")))).rejects.toThrow("Gemini could not respond in time");
  });
});