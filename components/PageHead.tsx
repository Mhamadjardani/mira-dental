import { Reveal } from "./Reveal";

export function PageHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-gradient-to-b from-mint/60 to-bg">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <Reveal>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
          {lead && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{lead}</p>}
        </Reveal>
      </div>
    </section>
  );
}
