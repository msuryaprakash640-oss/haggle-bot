import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/haggle/InfoPage";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Haggle Bot" },
      { name: "description", content: "Get in touch with the Haggle Bot team." },
      { property: "og:title", content: "Contact — Haggle Bot" },
      { property: "og:description", content: "Get in touch with the Haggle Bot team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <InfoPage
      eyebrow="Say hello"
      title="Contact"
      sections={[
        {
          heading: "Email",
          body: (
            <a className="font-mono text-primary hover:underline" href="mailto:hello@hagglebot.app">
              hello@hagglebot.app
            </a>
          ),
        },
        {
          heading: "Feedback",
          body: "Found a deal you loved or a negotiation that went sideways? We'd love to hear about it.",
        },
      ]}
    />
  ),
});
