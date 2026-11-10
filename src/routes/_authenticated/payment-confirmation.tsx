import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { z } from "zod";
import { verifyPayment } from "@/lib/haggle-api.functions";
import { unwrap } from "@/lib/api-result";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/channel3";

export const Route = createFileRoute("/_authenticated/payment-confirmation")({
  validateSearch: (input: Record<string, unknown>) => ({ orderId: z.string().uuid().catch("").parse(input["orderId"]) }),
  head: () => ({ meta: [{ title: "Sandbox Payment Confirmation — Haggle Bot" }, { name: "description", content: "Verify your Haggle Bot PayPal Sandbox payment and transaction reference." }, { property: "og:title", content: "Sandbox Payment Confirmation — Haggle Bot" }, { property: "og:description", content: "Your verified Sandbox payment status." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Confirmation,
});
function Confirmation() {
  const { orderId } = Route.useSearch();
  const verify = useServerFn(verifyPayment);
  const query = useQuery({ queryKey: ["paypal", "verification", orderId], queryFn: () => unwrap(verify({ data: { orderId } })), enabled: !!orderId });
  const verified = query.data?.verifiedWithProvider && query.data.order.paymentStatus === "paid" && query.data.order.transactionId;
  return <section className="mx-auto max-w-3xl px-4 py-16">
    <h1 className="font-display text-3xl font-bold">{verified ? "Sandbox payment confirmed" : "Sandbox payment verification"}</h1>
    {query.isPending && orderId && <p role="status" className="mt-6 flex items-center gap-2"><LoaderCircle className="size-5 animate-spin" />Checking PayPal…</p>}
    {(!orderId || query.error) && <p role="alert" className="mt-6 text-accent">{query.error?.message ?? "Choose an order to verify."}</p>}
    {verified && query.data && <div className="mt-8 space-y-4 border-y border-border py-6"><CheckCircle2 className="size-10 text-success" /><p className="font-mono text-2xl text-primary">{formatMoney(query.data.order.approvedPrice, query.data.order.currency)}</p><p className="break-all text-sm">Transaction: {query.data.order.transactionId}</p><p className="text-muted-foreground">PayPal verified this Sandbox capture. No real money was charged and no retailer order was placed.</p></div>}
    {query.data && !verified && <p role="alert" className="mt-6 text-accent">{query.data.reason ?? "No completed payment could be verified."}</p>}
    <div className="mt-8 flex flex-wrap gap-3"><Button asChild variant="neon"><Link to="/orders">Your orders</Link></Button>{orderId && !verified && <Button variant="glass" onClick={() => query.refetch()}>Check again</Button>}</div>
  </section>;
}