import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/haggle/InfoPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Haggle Bot" },
      { name: "description", content: "How Haggle Bot handles your searches, budgets and deal history." },
      { property: "og:title", content: "Privacy Policy — Haggle Bot" },
      { property: "og:description", content: "How Haggle Bot handles your searches, budgets and deal history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <InfoPage
      eyebrow="Legal"
      title="Privacy Policy"
      sections={[
        {
          heading: "What we store",
          body: "Your searches, budgets and deal history are kept in your own browser on this device. Nothing is sent to sellers.",
        },
        {
          heading: "Payments",
          body: "Checkout in this demo is a sandbox simulation. No payment details are collected or stored.",
        },
        {
          heading: "Your control",
          body: "You can clear your deal history at any time from the My Deals page.",
        },
      ]}
    />
  ),
});
