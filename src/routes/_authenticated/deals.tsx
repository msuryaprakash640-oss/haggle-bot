import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useNegotiationHistory } from "@/hooks/use-haggle-api";
import { NegotiationChat } from "@/components/haggle/NegotiationChat";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/_authenticated/deals")({
  head: () => ({ meta: [{ title: "My Negotiations — Haggle Bot" }, { name: "description", content: "View your personal saved Haggle Bot negotiations." }, { property: "og:title", content: "My Negotiations — Haggle Bot" }, { property: "og:description", content: "Your saved negotiation conversations." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Deals,
});
function Deals() {
  const [selected, setSelected] = useState<string>();
  const history = useNegotiationHistory(selected);
  return <section className="mx-auto max-w-5xl px-4 py-16"><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="font-display text-3xl font-bold">Your negotiations</h1><Button asChild variant="neon"><Link to="/dashboard">Start Negotiating</Link></Button></div>
    {selected && <Button className="mt-6" variant="glass" onClick={() => setSelected(undefined)}>All negotiations</Button>}
    {history.isPending && <p role="status" className="mt-8">Loading negotiations…</p>}
    {history.error && <div className="mt-8" role="alert"><p>{history.error.message}</p><Button className="mt-3" variant="neon" onClick={() => history.refetch()}>Retry</Button></div>}
    {history.data && <div className="mt-8 space-y-4">{history.data.negotiations.length === 0 && <p className="text-muted-foreground">No saved negotiations yet.</p>}{history.data.negotiations.map(n => <article key={n.id} className="rounded-lg border border-border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display font-semibold">{n.productName ?? "Negotiation"}</h2><p className="mt-2 text-sm text-muted-foreground">{new Date(n.createdAt).toLocaleString()} · {n.status.replaceAll("_", " ")}</p></div>{!selected && <Button variant="neon" onClick={() => setSelected(n.id)}>View conversation</Button>}</div>{selected && <div className="mt-6"><NegotiationChat title="Saved conversation" statusLabel="AI-simulated" messages={n.messages.map(m => ({ role: m.sender === "user" ? "user" : "bot", text: m.message }))} typing={null} /></div>}</article>)}</div>}
  </section>;
}