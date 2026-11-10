import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, BadgeCheck, Bot, Handshake, Scale, Search, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/haggle/SiteChrome";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Haggle Bot Works — Three steps, one smarter deal" },
      {
        name: "description",
        content: "Discover, negotiate, approve. See how Haggle Bot's AI agent finds offers and bargains within your budget.",
      },
      { property: "og:title", content: "How Haggle Bot Works" },
      { property: "og:description", content: "Three steps. One smarter deal. Discover, negotiate, approve & pay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorks,
});

const STEPS = [
  {
    n: "01",
    title: "Discover",
    icon: Search,
    tone: "text-primary",
    body: "Tell us what you want and set your budget. Our AI searches for matching products and available offers.",
  },
  {
    n: "02",
    title: "Negotiate",
    icon: Handshake,
    tone: "text-secondary",
    body: "Let your AI agent analyze prices, calculate offers and negotiate for a better deal.",
  },
  {
    n: "03",
    title: "Approve & Pay",
    icon: BadgeCheck,
    tone: "text-accent",
    body: "Review your final deal. You decide whether to approve it and proceed through PayPal.",
  },
];

const WHY = [
  { icon: Bot, title: "AI-Powered Negotiation", body: "Let AI do the bargaining." },
  { icon: ShieldCheck, title: "Budget Protection", body: "Never negotiate beyond your set limit." },
  { icon: Scale, title: "Smart Price Comparison", body: "Discover better available offers." },
  { icon: Wallet, title: "User-Controlled Payments", body: "You approve every purchase." },
  { icon: Sparkles, title: "One Smart Shopping Companion", body: "Less searching, more saving." },
];

function HowItWorks() {
  return (
    <>
      <PageHero
        eyebrow="How Haggle Bot works"
        title={
          <>
            Three steps. <span className="text-gradient">One smarter deal.</span>
          </>
        }
      />
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="relative grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, type: "spring", stiffness: 140, damping: 18 }}
              className="glass relative overflow-hidden rounded-3xl p-8"
            >
              <span className="absolute -right-3 -top-6 font-display text-[7rem] font-black leading-none text-foreground/5">
                {s.n}
              </span>
              <s.icon className={`size-10 ${s.tone}`} />
              <div className="mt-6 font-mono text-xs text-muted-foreground">{s.n}</div>
              <h2 className="font-display text-2xl font-bold">{s.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center font-display text-3xl font-bold sm:text-5xl">Why Haggle Bot?</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {WHY.map((w, i) => (
            <motion.div
              key={w.title}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className="glass rounded-3xl p-6"
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
                <w.icon className="size-6" />
              </div>
              <h3 className="mt-5 font-display text-base font-semibold">{w.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{w.body}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-14 text-center">
          <Button asChild variant="hero" size="xl">
            <a href="/#find">
              Start Negotiating <ArrowRight />
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
