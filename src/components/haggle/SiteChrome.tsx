import { Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { useAccount } from "./AccountProvider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NAV = [
  { to: "/", label: "Explore" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/deals", label: "My Deals" },
  { to: "/about", label: "About Us" },
] as const;

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-lime text-primary-foreground glow-primary">
        <Bot className="size-5" />
      </span>
      <span className="font-display text-base font-black tracking-tight">
        HAGGLE<span className="text-primary">BOT</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { user, ready, signOut } = useAccount();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: true }}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground data-[status=active]:bg-surface-strong data-[status=active]:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          to="/deals"
          className="rounded-full border border-primary/40 px-4 py-2 text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-foreground md:hidden"
        >
          My Deals
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {ready && user ? <><Button asChild variant="neon" className="hidden lg:inline-flex"><Link to="/dashboard">Dashboard</Link></Button><Button variant="glass" onClick={() => { void signOut().catch(error => toast.error(error.message)); }}>Sign Out</Button></> : <Button asChild variant="neon"><Link to="/auth">Sign In</Link></Button>}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">Shop smarter. Negotiate better. Save more.</p>
        </div>
        <nav className="flex flex-col gap-2 text-sm">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="text-muted-foreground hover:text-primary">
              {n.label}
            </Link>
          ))}
        </nav>
        <nav className="flex flex-col gap-2 text-sm">
          <Link to="/privacy" className="text-muted-foreground hover:text-primary">Privacy Policy</Link>
          <Link to="/terms" className="text-muted-foreground hover:text-primary">Terms &amp; Conditions</Link>
          <Link to="/contact" className="text-muted-foreground hover:text-primary">Contact</Link>
        </nav>
      </div>
      <div className="border-t border-border py-5 text-center font-mono text-xs text-muted-foreground">
        © 2026 Haggle Bot. All rights reserved.
      </div>
    </footer>
  );
}

export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: React.ReactNode; intro?: string }) {
  return (
    <section className="relative overflow-hidden pb-10 pt-20">
      <div className="pointer-events-none absolute inset-0 bg-hero" />
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="relative mx-auto max-w-4xl px-4 text-center">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary">{eyebrow}</div>
        <h1 className="mt-4 font-display text-4xl font-black leading-tight sm:text-6xl">{title}</h1>
        {intro && <p className="mx-auto mt-5 max-w-xl text-muted-foreground">{intro}</p>}
      </div>
    </section>
  );
}
