import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Search, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  budgetRange,
  findProduct,
  formatINR,
  getOffers,
  hashString,
  negotiate,
  type NegotiationResult,
  type Offer,
  type Product,
} from "@/lib/haggle";
import { addDeal, updateDealStatus } from "@/lib/deal-history";
import { cn } from "@/lib/utils";
import { HaggleOrb, type OrbMood } from "./HaggleOrb";
import { NegotiationChat, useScriptPlayer } from "./NegotiationChat";
import { PriceCompare } from "./PriceCompare";
import { StageProgress } from "./StageProgress";
import { DealReview } from "./DealReview";
import { Celebration } from "./Celebration";
import { PRODUCT_IMAGES } from "./product-images";
import { LiveResults, type LiveSearchRequest } from "./LiveResults";
import { LIVE_CURRENCIES, type LiveCurrency } from "@/lib/channel3";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccount } from "./AccountProvider";
import { Link } from "@tanstack/react-router";
import { needsSignIn } from "@/lib/auth-validation";

export interface FinderRequest {
  query: string;
  budget?: number | undefined;
  autorun: boolean;
  nonce: number;
}

type Phase = "idle" | "searching" | "comparing" | "negotiating" | "found" | "nodeal";

interface Run {
  product: Product;
  offers: Offer[];
  budget: number;
  result: NegotiationResult;
}

const CHIPS = ["iPhone 17", "Sony headphones", "Nike sneakers", "MacBook Air"];

export function DealFinder({ request }: { request?: FinderRequest | null }) {
  const { user } = useAccount();
  const [authRequired, setAuthRequired] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"demo" | "live">("live");
  const [currency, setCurrency] = useState<LiveCurrency>("USD");
  const [liveBudget, setLiveBudget] = useState(100);
  const [liveRequest, setLiveRequest] = useState<LiveSearchRequest | null>(null);
  const [budget, setBudget] = useState(8000);
  const [budgetTouched, setBudgetTouched] = useState(false);
  const [typing, setTyping] = useState(false);
  const [sliding, setSliding] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState<Run | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const dealId = useRef<string | null>(null);
  const timers = useRef<number[]>([]);
  const typingTimer = useRef<number>(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const preview = useMemo(() => findProduct(query || "sony headphones"), [query]);
  const range = useMemo(() => budgetRange(preview.listPrice), [preview.listPrice]);

  // Keep budget sensible for the product being typed.
  useEffect(() => {
    if (!budgetTouched) setBudget(range.suggested);
    else setBudget((b) => Math.min(range.max, Math.max(range.min, b)));
  }, [range, budgetTouched]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    setRun(null); setPhase("idle"); setDecision(null); setCelebrate(false);
  }, [user?.id]);

  const start = (q = query, b = budget) => {
    if (!q.trim()) return;
    if (mode === "live") {
      if (!Number.isFinite(liveBudget) || liveBudget <= 0 || liveBudget > 100_000_000 || q.trim().length > 100) return;
      setLiveRequest({ query: q.trim(), budget: liveBudget, currency, nonce: Date.now() });
      return;
    }
    if (needsSignIn(user)) { setAuthRequired(true); return; }
    setAuthRequired(false);
    timers.current.forEach(clearTimeout);
    const product = findProduct(q);
    const seed = hashString(q.toLowerCase() + b);
    const offers = getOffers(product, seed);
    const offer = offers[0];
    if (!offer) return;
    const result = negotiate({ productName: product.name, offer, budget: b, seed });
    setRun({ product, offers, budget: b, result });
    setDecision(null);
    dealId.current = null;
    setPhase("searching");
    timers.current = [
      window.setTimeout(() => setPhase("comparing"), 1900),
      window.setTimeout(() => setPhase("negotiating"), 4600),
    ];
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };

  // External requests (trending cards, agent demo).
  useEffect(() => {
    if (!request) return;
    setMode("demo");
    setQuery(request.query);
    const p = findProduct(request.query);
    const r = budgetRange(p.listPrice);
    const b = request.budget ?? r.suggested;
    setBudget(b);
    setBudgetTouched(request.budget !== undefined);
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (request.autorun) {
      if (needsSignIn(user)) { setAuthRequired(true); return; }
      // External cards explicitly represent the original demo.
      const product = findProduct(request.query);
      const seed = hashString(request.query.toLowerCase() + b);
      const offers = getOffers(product, seed);
      const offer = offers[0];
      if (!offer) return;
      const result = negotiate({ productName: product.name, offer, budget: b, seed });
      setRun({ product, offers, budget: b, result }); setDecision(null); setPhase("searching");
      timers.current.forEach(clearTimeout);
      timers.current = [window.setTimeout(() => setPhase("comparing"), 1900), window.setTimeout(() => setPhase("negotiating"), 4600)];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce]);

  const script = run?.result.messages ?? null;
  const chatPlaying = phase === "negotiating" || phase === "found" || phase === "nodeal";
  const { visible, typing: chatTyping } = useScriptPlayer(script, {
    playing: chatPlaying && !!user,
    onDone: () => {
      if (!run || needsSignIn(user)) return;
      if (run.result.success) setPhase("found");
      else {
        setPhase("nodeal");
        addDeal({
          product: run.product.name,
          seller: run.result.seller,
          originalPrice: run.result.startPrice,
          savings: 0,
          status: "no-deal",
        });
      }
    },
  });

  const approve = () => {
    if (!run || needsSignIn(user)) return;
    const rec = addDeal({
      product: run.product.name,
      seller: run.result.seller,
      originalPrice: run.result.startPrice,
      finalPrice: run.result.finalPrice,
      savings: run.result.savings,
      status: "approved",
    });
    dealId.current = rec.id;
    setDecision("approved");
    setCelebrate(true);
  };

  const reject = () => {
    if (!run || needsSignIn(user)) return;
    addDeal({
      product: run.product.name,
      seller: run.result.seller,
      originalPrice: run.result.startPrice,
      finalPrice: run.result.finalPrice,
      savings: 0,
      status: "rejected",
    });
    setDecision("rejected");
  };

  const ratio = budget / preview.listPrice;
  const health =
    ratio >= 0.9
      ? { label: "Comfortable", tone: "text-success", bar: "bg-success" }
      : ratio >= 0.82
        ? { label: "Ambitious", tone: "text-secondary", bar: "bg-secondary" }
        : { label: "Bold — may not close", tone: "text-accent", bar: "bg-accent" };

  const mood: OrbMood =
    phase === "searching" || phase === "comparing"
      ? "thinking"
      : phase === "negotiating"
        ? "negotiating"
        : phase === "found"
          ? decision === "rejected"
            ? "sad"
            : "happy"
          : phase === "nodeal"
            ? "sad"
            : typing || sliding
              ? "listening"
              : "idle";

  const matched = query.trim() && preview.id !== "custom";
  const say =
    phase === "searching"
      ? "Scanning 4 stores…"
      : phase === "comparing"
        ? "Crunching the numbers…"
        : phase === "negotiating"
          ? "Leave the haggling to me 😎"
          : phase === "found"
            ? decision === "rejected"
              ? "No worries. Your call, always."
              : "We did it! 🎉"
            : phase === "nodeal"
              ? "Budget held. No overpaying."
              : sliding
                ? `${formatINR(budget)}? ${health.label.split(" ")[0]}!`
                : typing
                  ? matched
                    ? `Ooh, ${preview.short}? On it.`
                    : "Tell me more…"
                  : "What are we hunting today?";

  const stageIndex =
    phase === "searching" ? 0 : phase === "comparing" ? 1 : phase === "negotiating" ? 2 : 3;
  const busy = phase === "searching" || phase === "comparing" || phase === "negotiating";

  return (
    <section ref={sectionRef} id="find" className="relative scroll-mt-24 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">01 · Find your perfect deal</div>
          <h2 className="mt-3 font-display text-3xl font-bold sm:text-5xl">What are you looking for?</h2>
          <p className="mt-3 text-muted-foreground">Search for any product and let Haggle Bot do the hard work.</p>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[300px_1fr]">
          <div className="hidden justify-center pt-8 lg:flex">
            <HaggleOrb
              mood={mood}
              size={240}
              say={say}
              gazeX={typing ? Math.min(1, (query.length % 24) / 12 - 1) : undefined}
            />
          </div>

          <form
            className="glass neon-border rounded-3xl p-6 sm:p-8"
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            <div role="group" aria-label="Product search mode" className="mb-6 flex flex-wrap gap-2">
              <Button type="button" disabled={!ready} variant={mode === "live" ? "neon" : "glass"} aria-pressed={mode === "live"} onClick={() => setMode("live")}>Live products</Button>
              <Button type="button" variant={mode === "demo" ? "neon" : "glass"} aria-pressed={mode === "demo"} onClick={() => setMode("demo")}>Demo negotiation</Button>
            </div>
            <div className="mb-5 flex items-center gap-3 lg:hidden">
              <HaggleOrb mood={mood} size={64} />
              <span className="text-sm font-semibold">{say}</span>
            </div>
            <label className="text-sm font-semibold" htmlFor="q">
              Product
            </label>
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-input bg-background/60 px-4 focus-within:border-primary focus-within:glow-primary">
              <Search className="size-5 text-muted-foreground" />
              <input
                id="q"
                value={query}
                maxLength={100}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setTyping(true);
                  window.clearTimeout(typingTimer.current);
                  typingTimer.current = window.setTimeout(() => setTyping(false), 1200);
                }}
                placeholder={mode === "live" ? "Wireless headphones for running, under $100…" : "Try iPhone 17, Sony headphones, Nike sneakers..."}
                className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
                autoComplete="off"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => {
                    setQuery(c);
                    setBudgetTouched(false);
                    setTyping(true);
                    window.clearTimeout(typingTimer.current);
                    typingTimer.current = window.setTimeout(() => setTyping(false), 1200);
                  }}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
              <label className="text-sm font-semibold" htmlFor="budget">
                Your maximum budget
              </label>
              <div className="flex items-center gap-1 rounded-xl border border-input bg-background/60 px-3 focus-within:border-primary">
                <span className="font-mono text-primary">{mode === "demo" ? "₹" : currency}</span>
                <input
                  id="budget"
                  type="number"
                  inputMode="numeric"
                  placeholder="Enter your budget"
                  value={mode === "demo" ? budget : liveBudget}
                  min={mode === "live" ? 0.01 : 1}
                  max={100_000_000}
                  step={mode === "live" ? "0.01" : "1"}
                  onChange={(e) => {
                    if (mode === "live") { setLiveBudget(Math.max(0, Number(e.target.value) || 0)); return; }
                    setBudgetTouched(true);
                    setBudget(Math.max(0, Number(e.target.value) || 0));
                  }}
                  className="h-11 w-32 bg-transparent text-right font-mono text-lg font-bold outline-none"
                />
              </div>
            </div>
            {mode === "live" && <div className="mt-4 flex flex-wrap items-center gap-3">
              <Select value={currency} onValueChange={(value: LiveCurrency) => { setCurrency(value); setLiveRequest(null); }}>
                <SelectTrigger className="w-32" aria-label="Search currency"><SelectValue /></SelectTrigger>
                <SelectContent>{LIVE_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">INR is not supported by Channel3. No currency conversion.</p>
            </div>}
            {mode === "demo" && <>
            <Slider
              className="mt-5"
              min={range.min}
              max={range.max}
              step={range.step}
              value={[Math.min(range.max, Math.max(range.min, budget))]}
              onValueChange={([v]) => {
                setBudgetTouched(true);
                if (v !== undefined) setBudget(v);
                setSliding(true);
              }}
              onValueCommit={() => window.setTimeout(() => setSliding(false), 900)}
              aria-label="Maximum budget"
            />
            <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>{formatINR(range.min)}</span>
              <span>
                typical {formatINR(preview.listPrice)}
              </span>
              <span>{formatINR(range.max)}</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-strong">
                <motion.div
                  className={cn("h-full rounded-full", health.bar)}
                  animate={{ width: `${Math.min(100, Math.max(8, ((ratio - 0.5) / 0.7) * 100))}%` }}
                />
              </div>
              <span className={cn("font-mono text-xs font-bold", health.tone)}>{health.label}</span>
            </div>
            </>}

            <Button type="submit" variant="hero" size="xl" className="mt-8 w-full" disabled={!query.trim() || (mode === "demo" ? busy || budget <= 0 : liveBudget <= 0 || liveBudget > 100_000_000)}>
              <Sparkles /> {mode === "live" ? "Find live products" : busy ? "Working on it…" : "Let AI Find My Deal ✨"}
            </Button>
            <p className="mt-3 text-center text-xs italic text-muted-foreground">
              Smart shopping starts with a smarter budget.
            </p>
            {authRequired && !user && <div className="mt-5 space-y-3" role="status"><p className="text-sm text-muted-foreground">Sign in to start a negotiation.</p><div className="flex flex-wrap gap-3"><Button asChild variant="neon"><Link to="/auth">Sign In</Link></Button><Button asChild variant="glass"><Link to="/sign-up">Create Account</Link></Button></div></div>}
          </form>
        </div>

        <div ref={resultsRef} className="scroll-mt-24">
          {mode === "live" && <LiveResults request={liveRequest} />}
          <AnimatePresence>
            {user && mode === "demo" && run && phase !== "idle" && (
              <motion.div
                key={run.product.name + run.budget}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-12 space-y-6"
              >
                <StageProgress active={stageIndex} complete={phase === "found" || phase === "nodeal"} />

                {phase === "searching" && <Scanning name={run.product.name} />}

                {phase !== "searching" && (
                  <div>
                    <div className="mb-3 flex items-baseline justify-between">
                      <h3 className="font-display text-lg font-semibold">
                        Price comparison · <span className="text-primary">{run.product.name}</span>
                      </h3>
                      <span className="font-mono text-xs text-muted-foreground">budget {formatINR(run.budget)}</span>
                    </div>
                    <PriceCompare offers={run.offers} budget={run.budget} />
                  </div>
                )}

                {chatPlaying && <NegotiationChat messages={visible} typing={chatTyping} />}

                {phase === "found" && (
                  <DealReview
                    productName={run.product.name}
                    image={PRODUCT_IMAGES[run.product.id]}
                    result={run.result}
                    onApprove={approve}
                    onReject={reject}
                    decided={decision}
                  />
                )}

                {phase === "nodeal" && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl border-accent/40 p-6"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="size-8 text-accent" />
                      <div>
                        <div className="font-display font-semibold">Budget protected</div>
                        <p className="text-sm text-muted-foreground">
                          Lowest simulated offer was {formatINR(run.result.bestSellerPrice)} — above your{" "}
                          {formatINR(run.budget)} limit.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="neon"
                      size="lg"
                      onClick={() => {
                        const b = Math.ceil(run.result.bestSellerPrice / 100) * 100;
                        setBudget(b);
                        setBudgetTouched(true);
                        start(query, b);
                      }}
                    >
                      <RotateCcw /> Retry at {formatINR(Math.ceil(run.result.bestSellerPrice / 100) * 100)}
                    </Button>
                  </motion.div>
                )}

                {decision === "rejected" && (
                  <div className="text-center">
                    <Button variant="glass" size="lg" onClick={() => start()}>
                      <RotateCcw /> Negotiate again
                    </Button>
                  </div>
                )}

                <p className="text-center text-xs text-muted-foreground">
                  Demo conversations use simulated seller responses. No real seller acceptance is implied.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {user && mode === "demo" && run?.result.success && run.result.finalPrice !== undefined && (
        <Celebration
          open={celebrate}
          onClose={() => setCelebrate(false)}
          productName={run.product.name}
          finalPrice={run.result.finalPrice}
          savings={run.result.savings}
          onPay={() => dealId.current && updateDealStatus(dealId.current, "paid-demo")}
        />
      )}
    </section>
  );
}

function Scanning({ name }: { name: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass relative overflow-hidden rounded-3xl p-6">
      <div className="flex items-center gap-4">
        <div className="relative size-16">
          <div className="absolute inset-0 rounded-full border border-secondary/40" />
          <div className="absolute inset-3 rounded-full border border-secondary/30" />
          <div
            className="absolute inset-0 animate-spin rounded-full"
            style={{ background: "conic-gradient(from 0deg, transparent 70%, var(--secondary))" }}
          />
        </div>
        <div>
          <div className="font-display font-semibold">Searching for {name}</div>
          <div className="font-mono text-xs text-muted-foreground">NovaMart · CircuitBay · UrbanKart · PixelHub</div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 overflow-hidden rounded-2xl bg-surface">
            <div className="size-full animate-shimmer" style={{ animationDelay: `${i * 0.2}s` }} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
