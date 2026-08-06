import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";

const highlights = [
  {
    title: "Academic + activity signals",
    body: "Pull curricular results together with extracurricular participation so the full student picture is visible.",
  },
  {
    title: "Attendance & engagement",
    body: "Track presence in class and events to spot patterns early — not just after report cards arrive.",
  },
  {
    title: "Teacher remarks, clarified",
    body: "Turn qualitative feedback into structured insight parents and students can actually act on.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
          <BrandMark size="sm" showWordmark />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-muted transition hover:text-foreground sm:inline"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-feezy-magenta px-4 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center px-6 py-16 sm:px-10 sm:py-24">
          <div className="feezy-rise mb-8">
            <BrandMark href={undefined} size="lg" />
          </div>

          <p className="feezy-rise feezy-rise-delay-1 text-sm font-semibold uppercase tracking-[0.16em] text-feezy-indigo">
            Feezypay
          </p>

          <h1 className="feezy-rise feezy-rise-delay-1 font-display mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-[3.4rem] md:leading-[1.08]">
            An AI layer on school ERP that helps every child be understood.
          </h1>

          <p className="feezy-rise feezy-rise-delay-2 mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Feezypay connects academic data, attendance, events, and teacher
            remarks — then turns them into insights and reports so students and
            parents can make wiser career decisions.
          </p>

          <div className="feezy-rise feezy-rise-delay-3 mt-9 flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-feezy-magenta px-7 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Start free setup
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-surface px-7 text-sm font-semibold text-foreground transition hover:bg-surface-strong"
            >
              Sign in to workspace
            </Link>
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 sm:grid-cols-3 sm:px-10 sm:py-16">
            {highlights.map((item) => (
              <div key={item.title} className="space-y-2">
                <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
                  {item.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
