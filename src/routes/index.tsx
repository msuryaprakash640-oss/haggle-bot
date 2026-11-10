import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { ArrowRight, BadgeCheck, History, Lock, ShieldCheck, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HaggleOrb } from "@/components/haggle/HaggleOrb";
import { DealFinder, type FinderRequest } from "@/components/haggle/DealFinder";
import { TrendingDeals } from "@/components/haggle/TrendingDeals";
import { AgentDemo } from "@/components/haggle/AgentDemo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Haggle Bot — Don't Just Shop. Negotiate." },
      {
        name: "description",
        content:
          "Meet your AI shopping agent. Search products, compare prices and let AI negotiate a better deal within your budget.",
      },
      { property: "og:title", content: "Haggle Bot — Don't Just Shop. Negotiate." },
      {
        property: "og:description",
        content: "Your AI. Your budget. Your deal. Let an AI agent compare prices and bargain for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TICKER = [
  "Sony headphones −₹1,599",
  "Nike sneakers −₹1,350",
  "MacBook Air −₹14,900",
  "iPhone 17 −₹9,950",
  "Budget protected ✓",
  "4 stores compared",
  "Deal found in 9s",
];

function Index() {
  const [request, setRequest] = useState<FinderRequest | null>(null);
  const send = (query: string, autorun: boolean, budget?: number) =>
    setRequest({ query, autorun, budget, nonce: Date.now() });

  return (
    <>
      <Hero />
      <Ticker />
      <DealFinder request={request} />
      <TrendingDeals onCompare={(p) => send(p.name, false)} onNegotiate={(p) => send(p.name, true)} />
      <AgentDemo onTry={() => send("Sony headphones", true, 8000)} />
      <DecisionBand />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-hero" />
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-16 lg:grid-cols-[1.15fr_1fr] lg:pt-24">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-primary"
          >
            <span className="size-1.5 rounded-full bg-primary animate-pulse" /> Your AI. Your Budget. Your Deal.
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 font-display text-5xl font-black leading-[0.95] sm:text-7xl"
          >
            Don't Just Shop.
            <br />
            <span className="text-gradient">Negotiate.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 max-w-lg text-lg text-muted-foreground"
          >
            Why pay more when AI can negotiate for less? Discover products, compare prices, negotiate with sellers and
            get the best possible deal — all in one place.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Button asChild variant="hero" size="xl">
              <a href="#find">
                Start Negotiating <ArrowRight />
              </a>
            </Button>
            <Button asChild variant="glass" size="xl">
              <a href="#trending">Explore Deals</a>
            </Button>
          </motion.div>
        </div>

        <div className="relative mx-auto grid size-[340px] place-items-center sm:size-[420px]">
          <HaggleOrb mood="idle" size={300} say="Hi! I haggle so you don't have to." />
          <FloatChip className="left-0 top-10" delay={0} icon={<TrendingDown className="size-4 text-primary" />}>
            ₹9,499 → <b className="text-primary">₹7,900</b>
          </FloatChip>
          <FloatChip className="-right-2 top-1/2" delay={1.2} icon={<ShieldCheck className="size-4 text-secondary" />}>
            Budget protected
          </FloatChip>
          <FloatChip className="bottom-6 left-6" delay={2.2} icon={<BadgeCheck className="size-4 text-accent" />}>
            Deal found · 9s
          </FloatChip>
        </div>
      </div>
    </section>
  );
}

function FloatChip({
  children,
  className,
  delay,
  icon,
}: {
  children: React.ReactNode;
  className: string;
  delay: number;
  icon: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1, y: [0, -12, 0] }}
      transition={{ opacity: { delay: 0.5 + delay * 0.3 }, y: { duration: 5, repeat: Infinity, delay } }}
      className={`absolute z-10 flex items-center gap-2 rounded-full glass px-4 py-2 font-mono text-xs ${className}`}
    >
      {icon}
      {children}
    </motion.div>
  );
}

function Ticker() {
  return (
    <div className="relative overflow-hidden border-y border-border bg-card/50 py-4">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-mono text-sm text-muted-foreground">
        {[...TICKER, ...TICKER].map((t, i) => (
          <span key={i} className="flex items-center gap-10">
            {t} <span className="text-primary">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function DecisionBand() {
  const items = [
    {
      icon: BadgeCheck,
      tone: "text-primary",
      title: "Your deal, your decision",
      body: "A better price is just the beginning. Review original price, negotiated price, savings and seller before anything happens.",
    },
    {
      icon: Lock,
      tone: "text-secondary",
      title: "Secure checkout",
      body: "Love the deal? Proceed through PayPal's checkout experience. Demo transactions are clearly identified.",
    },
    {
      icon: History,
      tone: "text-accent",
      title: "Your shopping history",
      body: "Every deal tells a story. Track negotiations, approved deals, savings and payment status in one place.",
    },
  ];
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-5 md:grid-cols-3">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-3xl p-7"
            >
              <it.icon className={`size-8 ${it.tone}`} />
              <h3 className="mt-5 font-display text-xl font-semibold">{it.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button asChild variant="neon" size="lg">
            <Link to="/deals">View My Deals</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-24">
      <div className="neon-border relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-card px-6 py-16 text-center sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-hero" />
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="relative">
          <h2 className="font-display text-4xl font-black sm:text-6xl">
            Stop paying the <span className="text-gradient">first price.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">Let AI negotiate your next purchase.</p>
          <Button asChild variant="hero" size="xl" className="mt-8">
            <a href="#find">
              Start Saving with Haggle Bot <ArrowRight />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
