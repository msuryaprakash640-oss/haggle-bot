import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, Send, RotateCcw, MessageSquarePlus } from "lucide-react";
import { useAccount } from "./AccountProvider";
import { Link } from "@tanstack/react-router";
import { geminiAssist, getGeminiHistory } from "@/lib/gemini.functions";
import { unwrap } from "@/lib/api-result";
import { formatMoney, type LiveCurrency } from "@/lib/channel3";
import { assistanceSchema } from "@/lib/gemini-negotiation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NegotiationChat } from "./NegotiationChat";

type Message = { id: string; sender_type: string; message: string; offer_amount: number | null; created_at: string };
export function GeminiAssistant({ productId, productName, budget, currency }: { productId: string; productName: string; budget: number; currency: LiveCurrency }) {
  const assist = useServerFn(geminiAssist);
  const historyFn = useServerFn(getGeminiHistory);
  const { user, ready } = useAccount();
  const userId = user?.id ?? null;
  const [message, setMessage] = useState("Suggest a reasonable target price and a polite negotiation message.");
  const [amount, setAmount] = useState("");
  const [validation, setValidation] = useState("");
  const [id, setId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const currentUser = useRef<string | null>(null);
  useEffect(() => {
    if (userId !== currentUser.current) { setId(undefined); setMessages([]); }
    currentUser.current = userId;
  }, [userId]);
  const history = useQuery({ queryKey: ["gemini-history", userId, productId, budget, currency], enabled: !!userId, queryFn: () => unwrap(historyFn({ data: { productId, budget, currency } })) });
  const send = useMutation({ mutationFn: (input: Parameters<typeof assistanceSchema.parse>[0]) => unwrap(assist({ data: assistanceSchema.parse(input) })), onSuccess: data => { setId(data.negotiationId); setMessages(data.messages); setMessage(""); setAmount(""); history.refetch(); } });
  const submit = () => {
    const input = { productId, budget, currency, negotiationId: id, message, offerAmount: amount ? Number(amount) : undefined };
    if (!assistanceSchema.safeParse(input).success) { setValidation("Enter a message (up to 500 characters) and a positive offer with up to two decimals."); return; }
    setValidation(""); send.mutate(input);
  };
  return <section className="mt-6 border-t border-border pt-6" aria-label="Gemini negotiation assistance">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-display text-lg font-semibold">Gemini · AI-simulated negotiation</h3><p className="mt-1 break-words text-sm text-muted-foreground">{productName} · Maximum {formatMoney(budget, currency)}</p></div>
      {userId && <Button variant="glass" disabled={send.isPending} onClick={() => { setId(undefined); setMessages([]); send.reset(); }}><MessageSquarePlus /> New conversation</Button>}
    </div>
    <p className="mb-5 text-xs text-muted-foreground">No seller contacted. Suggested prices are not guaranteed. Nothing is purchased or paid here.</p>
    {!ready ? <p role="status">Checking sign-in…</p> : !userId ? <div className="grid max-w-md gap-3">
      <p className="text-sm text-muted-foreground">Sign in to save your negotiation history.</p>
      <div className="flex flex-wrap gap-3"><Button asChild variant="neon"><Link to="/auth">Sign In</Link></Button><Button asChild variant="glass"><Link to="/sign-up">Create Account</Link></Button></div>
    </div> : <>
      {history.isPending && <p role="status" className="mb-3 text-sm text-muted-foreground">Loading saved conversations…</p>}
      {history.error && <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 text-sm text-accent">{history.error.message}<Button variant="glass" onClick={() => history.refetch()}><RotateCcw /> Retry history</Button></div>}
      {!!history.data?.sessions.length && <label className="mb-4 block text-sm">Saved conversations<select className="mt-1 block w-full rounded-md border border-input bg-background p-2 text-foreground" value={id ?? ""} disabled={send.isPending} onChange={e => { const session = history.data.sessions.find(s => s.id === e.target.value); setId(session?.id); setMessages(session?.messages ?? []); send.reset(); }}><option value="">New conversation</option>{history.data.sessions.map(s => <option key={s.id} value={s.id}>{new Date(s.createdAt).toLocaleString()} · {s.targetPrice ? formatMoney(s.targetPrice, currency) : "Draft"}</option>)}</select></label>}
      <NegotiationChat messages={messages.map(m => ({ role: m.sender_type === "user" ? "user" : "bot", text: m.message }))} typing={send.isPending ? "bot" : null} title="Gemini assistance" statusLabel="AI-simulated · drafts only" />
      <form className="mt-4 grid gap-3" onSubmit={e => { e.preventDefault(); submit(); }}>
        <label className="text-sm">Your message<Textarea maxLength={500} value={message} onChange={e => setMessage(e.target.value)} disabled={send.isPending} /></label>
        <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm">Offer to analyse ({currency}, optional)<Input type="number" min="0.01" max="100000000" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} disabled={send.isPending} /></label><Button variant="neon" disabled={send.isPending || !message.trim()}>{send.isPending ? <LoaderCircle className="animate-spin" /> : <Send />}{send.isPending ? "Thinking…" : "Send"}</Button></div>
        {validation && <p role="alert" className="text-sm text-accent">{validation}</p>}
        {send.error && <p role="alert" className="text-sm text-accent">{send.error.message} Your message is kept; send it again to retry.</p>}
      </form>
    </>}
  </section>;
}