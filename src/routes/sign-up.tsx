import { createFileRoute } from "@tanstack/react-router";
import { AccountForm } from "@/components/haggle/AccountForm";
export const Route = createFileRoute("/sign-up")({
  head: () => ({ meta: [{ title: "Create Account — Haggle Bot" }, { name: "description", content: "Create your Haggle Bot account and save your negotiation history." }, { property: "og:title", content: "Create Account — Haggle Bot" }, { property: "og:description", content: "Join Haggle Bot with your own shopper account." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <AccountForm signUp />,
});