import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ExternalLink, ImageOff, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { searchProducts } from "@/lib/haggle-api.functions";
import { unwrap } from "@/lib/api-result";
import { useComparePrices } from "@/hooks/use-haggle-api";
import { formatMoney, isAvailable, type LiveCurrency } from "@/lib/channel3";
import { cn } from "@/lib/utils";
import { GeminiAssistant } from "./GeminiAssistant";
import { PaypalCheckout } from "./PaypalCheckout";
import { PAYPAL_CURRENCIES } from "@/lib/paypal-validation";

export interface LiveSearchRequest { query: string; budget: number; currency: LiveCurrency; nonce: number }

export function LiveResults({ request }: { request: LiveSearchRequest | null }) {
  const search = useServerFn(searchProducts);
  const [selected, setSelected] = useState<string | null>(null);
  const { mutate, data, error, isPending } = useMutation({
    mutationFn: (input: LiveSearchRequest) => unwrap(search({ data: { query: input.query, budget: input.budget, currency: input.currency, mode: "live" } })),
  });
  useEffect(() => {
    setSelected(null);
    if (request) mutate(request);
  }, [request, mutate]);
  if (!request) return null;
  return (
    <div className="mt-12 space-y-6" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">Live products <span className="text-primary">· Channel3</span></h3>
        <span className="font-mono text-xs text-muted-foreground">budget {formatMoney(request.budget, request.currency)}</span>
      </div>
      {isPending ? <div role="status" className="flex items-center gap-3 py-8 text-secondary"><LoaderCircle className="size-5 animate-spin" /> Searching retailers…</div>
        : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-4 border-y border-accent/40 py-6"><p className="text-accent">{error.message}</p><Button variant="neon" onClick={() => mutate(request)}><RotateCcw /> Retry search</Button></div>
        : data?.results.length === 0 ? <p className="py-8 text-muted-foreground">No available products found under {formatMoney(request.budget, request.currency)}. Try another search or budget.</p>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.results.map((p, index) => <motion.article key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }} className="glass flex min-w-0 flex-col overflow-hidden rounded-lg">
            <ProductImage url={p.imageUrl} name={p.name} />
            <div className="flex flex-1 flex-col p-5">
              <span className="font-mono text-xs text-secondary">Live · {p.brand ?? "Brand not supplied"}</span>
              <h4 className="mt-2 break-words font-semibold">{p.name}</h4>
              <div className="mt-4 font-mono text-xl font-bold text-primary">{p.lowestPrice === null ? "Price not supplied" : formatMoney(p.lowestPrice, p.currency)}</div>
              <p className="mt-1 text-xs text-muted-foreground">{p.offerCount} available {p.offerCount === 1 ? "offer" : "offers"} within budget</p>
              <Button variant={selected === p.id ? "neon" : "glass"} className="mt-5 w-full" onClick={() => setSelected(p.id)}>Compare retailers</Button>
            </div>
          </motion.article>)}
        </div>}
      {selected && !isPending && !error && <LiveComparison productId={selected} currency={request.currency} budget={request.budget} />}
      <p className="text-xs text-muted-foreground">Retailer prices in {request.currency}. Shipping and taxes may be extra. Live seller negotiation and retailer purchasing are not connected.</p>
    </div>
  );
}

function ProductImage({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-surface-strong">
    {url && !failed ? <img src={url} alt={name} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-contain p-3" /> : <ImageOff className="size-10 text-muted-foreground" aria-label="Image unavailable" />}
  </div>;
}

function LiveComparison({ productId, currency, budget }: { productId: string; currency: LiveCurrency; budget: number }) {
  const comparison = useComparePrices(productId, currency);
  if (comparison.isPending) return <div role="status" className="flex items-center gap-3 py-8"><LoaderCircle className="size-5 animate-spin text-secondary" /> Updating retailer offers…</div>;
  if (comparison.error) return <div role="alert" className="flex flex-wrap items-center gap-4 py-6"><p className="text-accent">{comparison.error.message}</p><Button variant="neon" onClick={() => comparison.refetch()}><RotateCcw /> Retry comparison</Button></div>;
  const { data } = comparison;
  const availabilityLabels: Record<string, string> = { in_stock: "In stock", limited: "Limited availability", out_of_stock: "Out of stock", preorder: "Preorder" };
  return <section className="border-t border-border pt-6" aria-label="Live price comparison">
    <h3 className="mb-4 break-words font-display text-lg font-semibold">Price comparison · <span className="text-primary">{data.product.name}</span></h3>
    {data.offers.length === 0 ? <p className="text-muted-foreground">No retailer prices were supplied for this currency.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {data.offers.map((o) => <motion.article key={o.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={cn("flex min-w-0 flex-col rounded-lg p-4", o.id === data.bestOfferId ? "neon-border bg-primary/8" : "glass")}>
        {o.id === data.bestOfferId && <span className="mb-2 font-mono text-xs text-primary">Lowest available</span>}
        <h4 className="break-words font-semibold">{o.retailer}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{o.availability ? availabilityLabels[o.availability] ?? "Availability not supplied" : "Availability not supplied"}</p>
        <div className="mt-3 font-mono text-xl font-bold">{formatMoney(o.price, o.currency)}</div>
        <p className={cn("mt-2 text-xs", o.price <= budget ? "text-success" : "text-accent")}>{o.price <= budget ? "Within budget" : `${formatMoney(o.price - budget, currency)} over budget`}</p>
        {isAvailable(o.availability) && data.lowestPrice !== null && o.price > data.lowestPrice && <p className="mt-1 text-xs text-muted-foreground">{formatMoney(Math.round((o.price - data.lowestPrice) * 100) / 100, currency)} above lowest</p>}
        {o.url ? <Button asChild variant="glass" className="mt-4"><a href={o.url} target="_blank" rel="noopener noreferrer">View retailer <ExternalLink className="size-4" /></a></Button> : <p className="mt-4 text-xs text-muted-foreground">Retailer link not supplied</p>}
        {isAvailable(o.availability) && o.price <= budget && PAYPAL_CURRENCIES.some(c => c === o.currency) && <PaypalCheckout offerId={o.id} budget={budget} price={o.price} currency={o.currency} />}
      </motion.article>)}
    </div>}
    <p className="mt-4 text-xs text-muted-foreground">Offers updated from Channel3. Availability may change at the retailer.</p>
    {data.offers.some(o => isAvailable(o.availability)) && <GeminiAssistant key={`${productId}:${currency}:${budget}`} productId={productId} productName={data.product.name} currency={currency} budget={budget} />}
  </section>;
}