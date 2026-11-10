import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount } from "@/components/haggle/AccountProvider";
import { DealFinder } from "@/components/haggle/DealFinder";
import { Button } from "@/components/ui/button";
import { History, ShoppingBag } from "lucide-react";
export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Your Dashboard — Haggle Bot" }, { name: "description", content: "Find products and continue your personal Haggle Bot negotiations." }, { property: "og:title", content: "Your Dashboard — Haggle Bot" }, { property: "og:description", content: "Your shopping, budget and negotiations in one place." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Dashboard,
});
function Dashboard() {
  const { user } = useAccount();
  return <><section className="mx-auto max-w-6xl px-4 pt-12"><h1 className="font-display text-3xl font-bold">Your Haggle Bot dashboard</h1><p className="mt-3 text-muted-foreground">Welcome, {typeof user?.user_metadata["full_name"] === "string" ? user.user_metadata["full_name"] : "shopper"}.</p><div className="mt-5 flex flex-wrap gap-3"><Button asChild variant="neon"><Link to="/deals"><History /> My negotiations</Link></Button><Button asChild variant="glass"><Link to="/orders"><ShoppingBag /> My orders</Link></Button></div></section><DealFinder /></>;
}