import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AccountForm } from "@/components/haggle/AccountForm";
import { useAccount } from "@/components/haggle/AccountProvider";
export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign In — Haggle Bot" }, { name: "description", content: "Sign in to your Haggle Bot account to continue your negotiations." }, { property: "og:title", content: "Sign In — Haggle Bot" }, { property: "og:description", content: "Access your personal shopping dashboard." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: SignIn,
});
function SignIn() {
  const { user, ready } = useAccount(); const navigate = Route.useNavigate();
  useEffect(() => { if (ready && user) void navigate({ to: "/dashboard", replace: true }); }, [ready, user, navigate]);
  return <AccountForm />;
}