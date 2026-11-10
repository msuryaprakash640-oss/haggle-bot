import { paypalResponseSchema } from "../paypal-validation";

export type ProviderOrderStatus = "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";

export interface ProviderOrder {
  id: string;
  status: ProviderOrderStatus;
  amount: number;
  currency: string;
  approveUrl?: string | undefined;
  raw?: unknown;
}

export interface PaymentProvider {
  createOrder(input: { referenceId: string; amount: number; currency: string; description: string }): Promise<ProviderOrder>;
  captureOrder(providerOrderId: string, requestId: string): Promise<ProviderOrder>;
  getOrder(providerOrderId: string): Promise<ProviderOrder>;
}

/** Buyer approval link, only when it points at PayPal Sandbox. */
export function sandboxApproveUrl(raw: unknown): string | undefined {
  const links = (raw as { links?: Array<{ rel?: unknown; href?: unknown }> } | null)?.links;
  const href = links?.find(l => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (typeof href !== "string") return undefined;
  try { return new URL(href).host === "www.sandbox.paypal.com" ? href : undefined; } catch { return undefined; }
}

export function getPaymentProvider(): PaymentProvider | null {
  const key = process.env["PAYPAL_API_KEY"];
  const appKey = process.env["LOVABLE_API_KEY"];
  if (!key || !appKey) return null;
  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`https://connector-gateway.lovable.dev/paypal${path}`, {
      ...init, headers: { Authorization: `Bearer ${appKey}`, "X-Connection-Api-Key": key ?? "", "Content-Type": "application/json", Accept: "application/json", ...init.headers },
    });
    if (!response.ok) {
      // Never log provider bodies: they can contain buyer details or credentials.
      throw new Error(`PayPal Sandbox request failed (${response.status}). Please retry or check your PayPal connection.`);
    }
    const raw: unknown = await response.json();
    const data = paypalResponseSchema.parse(raw);
    const unit = data.purchase_units[0];
    const amount = unit?.payments?.captures?.[0]?.amount ?? unit?.amount;
    return { id: data.id, status: data.status, amount: Number(amount?.value ?? 0), currency: amount?.currency_code ?? "", approveUrl: sandboxApproveUrl(raw), raw };
  }
  return {
    createOrder: input => request("/v2/checkout/orders", { method: "POST", headers: { "PayPal-Request-Id": `create-${input.referenceId}`, Prefer: "return=representation" }, body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ reference_id: input.referenceId, description: `Sandbox only · ${input.description}`.slice(0, 127), amount: { currency_code: input.currency, value: input.amount.toFixed(2) } }], // No payment_source: that switches PayPal to the redirect flow (PAYER_ACTION_REQUIRED, needs
      // return/cancel URLs), which conflicts with the JS SDK popup the app uses.
      application_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } }) }),
    captureOrder: (id, requestId) => request(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, { method: "POST", headers: { "PayPal-Request-Id": `capture-${requestId}`, Prefer: "return=representation" }, body: "{}" }),
    getOrder: id => request(`/v2/checkout/orders/${encodeURIComponent(id)}`),
  };
}
