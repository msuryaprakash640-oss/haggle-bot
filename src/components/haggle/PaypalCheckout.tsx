import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreatePaypalOrder, useCapturePaypalOrder } from "@/hooks/use-haggle-api";
import { useAccount } from "./AccountProvider";
import { formatMoney } from "@/lib/channel3";

type PaypalButtons = { render: (element: HTMLElement) => Promise<void>; close: () => void };
type PaypalSdk = { Buttons: (options: { createOrder: () => Promise<string>; onApprove: (data: { orderID?: string }) => Promise<void>; onCancel: () => void; onError: (err: unknown) => void }) => PaypalButtons };
declare global { interface Window { paypal?: PaypalSdk } }

export function PaypalCheckout({ offerId, budget, price, currency }: { offerId: string; budget: number; price: number; currency: string }) {
  const { user } = useAccount();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const orderId = useRef<string | null>(null);
  const providerId = useRef<string | null>(null);
  const create = useCreatePaypalOrder();
  const capture = useCapturePaypalOrder();
  const navigate = useNavigate();
  const createRef = useRef(create.mutateAsync);
  const captureRef = useRef(capture.mutateAsync);
  createRef.current = create.mutateAsync; captureRef.current = capture.mutateAsync;
  useEffect(() => {
    if (!open || !user) return;
    const clientId = import.meta.env["VITE_LOVABLE_CONNECTOR_PAYPAL_CLIENT_ID"];
    if (!clientId) { setError("PayPal Sandbox is not configured."); return; }
    let buttons: PaypalButtons | undefined;
    let disposed = false;
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`;
    script.async = true;
    script.onerror = () => setError("PayPal could not load. Please retry checkout.");
    script.onload = () => {
      if (disposed || !container.current || !window.paypal) return;
      buttons = window.paypal.Buttons({
        createOrder: async () => {
          setError(null);
          if (providerId.current) return providerId.current;
          try {
            const result = await createRef.current({ retailerOfferId: offerId, budget });
            if (!result.order.paypalOrderId) throw new Error("PayPal did not return an order.");
            orderId.current = result.order.id; providerId.current = result.order.paypalOrderId;
            return result.order.paypalOrderId;
          } catch (e) { setError(e instanceof Error ? e.message : "Checkout failed."); throw e; }
        },
        onApprove: async (data) => {
          if (!orderId.current || !providerId.current) { setError("Order not found. Please retry."); return; }
          if (data.orderID !== providerId.current) { setError("PayPal approved a different order. Nothing was captured."); return; }
          try {
            const result = await captureRef.current(orderId.current);
            if (result.order.paymentStatus !== "paid" || !result.order.transactionId) throw new Error("Payment has not been verified.");
            await navigate({ to: "/payment-confirmation", search: { orderId: result.order.id } });
          } catch (e) { setError(e instanceof Error ? e.message : "Payment verification failed. Check Your orders before retrying."); }
        },
        onCancel: () => setError("Payment cancelled. No payment was captured; the order remains unpaid."),
        onError: (err) => { console.warn("PayPal Sandbox checkout error", err); setError(previous => previous ?? "PayPal checkout failed. No payment was marked paid. Check Your orders before retrying."); },
      });
      void buttons.render(container.current).catch(() => setError("PayPal could not display checkout. Please retry."));
    };
    document.head.appendChild(script);
    return () => { disposed = true; buttons?.close(); script.remove(); };
  }, [open, user, offerId, budget, currency, navigate]);
  if (!user) return <Button asChild variant="glass" className="mt-3"><Link to="/auth">Sign in for Sandbox checkout</Link></Button>;
  return <div className="mt-3 space-y-3">
    <Button variant="neon" className="w-full" onClick={() => { setError(null); setOpen(value => !value); }}><Lock className="size-4" />{open ? "Close checkout" : "Test PayPal Sandbox"}</Button>
    {open && <>
      <p className="text-xs text-muted-foreground">Sandbox only · {formatMoney(price, currency)} listed price. No real money, retailer purchase or delivery. AI targets are not used.</p>
      <div ref={container} className="min-h-12" aria-label="PayPal Sandbox checkout" />
      {(create.isPending || capture.isPending) && <p role="status" className="flex items-center gap-2 text-xs text-secondary"><LoaderCircle className="size-4 animate-spin" />{capture.isPending ? "Verifying payment…" : "Creating Sandbox order…"}</p>}
      {error && <p role="alert" className="break-words text-xs text-accent">{error}</p>}
    </>}
  </div>;
}