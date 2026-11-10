import { PageHero } from "./SiteChrome";

export function InfoPage({
  eyebrow,
  title,
  sections,
}: {
  eyebrow: string;
  title: string;
  sections: { heading: string; body: React.ReactNode }[];
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} />
      <section className="mx-auto max-w-3xl space-y-6 px-4 pb-24">
        {sections.map((s) => (
          <div key={s.heading} className="glass rounded-3xl p-7">
            <h2 className="font-display text-lg font-semibold">{s.heading}</h2>
            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</div>
          </div>
        ))}
      </section>
    </>
  );
}
