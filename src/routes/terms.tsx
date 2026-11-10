import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/haggle/InfoPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Haggle Bot" },
      { name: "description", content: "The terms for using Haggle Bot's AI negotiation demo." },
      { property: "og:title", content: "Terms & Conditions — Haggle Bot" },
      { property: "og:description", content: "The terms for using Haggle Bot's AI negotiation demo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <InfoPage
      eyebrow="Legal"
      title="Terms & Conditions"
      sections={[
        {
          heading: "Simulated negotiations",
          body: "Demo conversations use simulated seller responses. No real seller acceptance is implied.",
        },
        {
          heading: "Your approval",
          body: "No purchase is ever made without your explicit approval. The agent never negotiates beyond your set budget.",
        },
        {
          heading: "Sandbox payments",
          body: "Demo transactions are clearly identified. Sandbox payments do not purchase products from external retailers.",
        },
      ]}
    />
  ),
});
