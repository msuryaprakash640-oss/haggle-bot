import { createFileRoute } from "@tanstack/react-router";
import { HaggleOrb } from "@/components/haggle/HaggleOrb";
import { PageHero } from "@/components/haggle/SiteChrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Haggle Bot — Shop smarter, negotiate better" },
      {
        name: "description",
        content: "Haggle Bot is a personal AI shopping agent that compares prices and negotiates within your budget.",
      },
      { property: "og:title", content: "About Haggle Bot" },
      { property: "og:description", content: "Shop smarter. Negotiate better. Save more." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        title={
          <>
            Shop smarter. <span className="text-gradient">Negotiate better.</span>
          </>
        }
        intro="Haggle Bot is your personal AI shopping agent — built so nobody has to pay the first price again."
      />
      <section className="mx-auto grid max-w-5xl items-center gap-12 px-4 pb-24 md:grid-cols-[1fr_280px]">
        <div className="space-y-5 text-muted-foreground">
          <p>
            Bargaining is a skill most of us never get to practise online. Haggle Bot brings it back: you set the
            product and the limit, and an AI agent searches offers, compares prices and negotiates on your behalf.
          </p>
          <p>
            Two rules are built in. First, the agent never negotiates beyond your budget. Second, nothing is
            purchased without your explicit approval.
          </p>
          <p className="text-sm">
            This experience is a demo: seller responses are simulated and sandbox payments do not purchase products
            from external retailers.
          </p>
        </div>
        <div className="flex justify-center">
          <HaggleOrb mood="happy" size={240} />
        </div>
      </section>
    </>
  );
}
