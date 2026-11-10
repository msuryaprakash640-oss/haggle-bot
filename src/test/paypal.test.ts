import { afterEach, describe, expect, it, vi } from "vitest";
import { listedCheckoutPrice, verifiedCapture } from "../lib/paypal-validation";
import { getPaymentProvider, sandboxApproveUrl } from "../lib/integrations/paypal.server";

const expected = { providerId: "paypal-order", referenceId: "local-order", amount: 11.79, currency: "USD" };
const completed = () => ({ id: "paypal-order", status: "COMPLETED", purchase_units: [{ reference_id: "local-order", payments: { captures: [{ id: "capture-id", status: "COMPLETED", final_capture: true, amount: { currency_code: "USD", value: "11.79" } }] } }] });
const offer = { original_price: 11.79, currency: "USD", availability_status: "in_stock" };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("PayPal Sandbox payment rules", () => {
  it("charges trusted listed price, never Gemini's $10 suggestion", () => {
    expect(listedCheckoutPrice(offer, 15)).toEqual({ amount: 11.79, currency: "USD" });
    expect(() => listedCheckoutPrice(offer, 10)).toThrow(/above your budget/);
  });
  it("rejects unavailable offers", () => expect(() => listedCheckoutPrice({ ...offer, availability_status: "out_of_stock" }, 15)).toThrow(/no longer available/));
  it("rejects unsupported currency without conversion", () => expect(() => listedCheckoutPrice({ ...offer, currency: "INR" }, 15)).toThrow(/currency/));
  it("requires a completed exact capture before marking paid", () => {
    expect(verifiedCapture(completed(), expected)).toBe("capture-id");
    for (const status of ["CREATED", "APPROVED", "VOIDED"]) expect(verifiedCapture({ ...completed(), status }, expected)).toBeNull();
  });
  it("rejects mismatched amount currency order and local reference", () => {
    expect(verifiedCapture(completed(), { ...expected, amount: 10 })).toBeNull();
    expect(verifiedCapture(completed(), { ...expected, currency: "EUR" })).toBeNull();
    expect(verifiedCapture(completed(), { ...expected, providerId: "another-order" })).toBeNull();
    expect(verifiedCapture(completed(), { ...expected, referenceId: "another-user-order" })).toBeNull();
  });
  it("rejects pending and partial captures", () => {
    const response = completed();
    const capture = response.purchase_units[0]?.payments.captures[0];
    if (!capture) throw new Error("Test capture missing");
    capture.status = "PENDING";
    expect(verifiedCapture(response, expected)).toBeNull();
    capture.status = "COMPLETED";
    capture.final_capture = false;
    expect(verifiedCapture(response, expected)).toBeNull();
  });
  it("returns only PayPal Sandbox approval links", () => {
    expect(sandboxApproveUrl({ links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ABC" }] })).toBe("https://www.sandbox.paypal.com/checkoutnow?token=ABC");
    expect(sandboxApproveUrl({ links: [{ rel: "payer-action", href: "https://www.paypal.com/checkoutnow?token=ABC" }] })).toBeUndefined();
    expect(sandboxApproveUrl({ links: [] })).toBeUndefined();
  });
  it("reuses the same capture idempotency key on retries and uses only gateway calls", async () => {
    vi.stubEnv("PAYPAL_API_KEY", "test-key"); vi.stubEnv("LOVABLE_API_KEY", "test-app-key");
    const fetcher = vi.fn().mockImplementation(async () => Response.json(completed())); vi.stubGlobal("fetch", fetcher);
    const provider = getPaymentProvider();
    if (!provider) throw new Error("Test provider unavailable");
    await provider.captureOrder("paypal-order", "local-order"); await provider.captureOrder("paypal-order", "local-order");
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const call of fetcher.mock.calls) {
      expect(call[0]).toBe("https://connector-gateway.lovable.dev/paypal/v2/checkout/orders/paypal-order/capture");
      expect(call[1].headers["PayPal-Request-Id"]).toBe("capture-local-order");
    }
  });
});