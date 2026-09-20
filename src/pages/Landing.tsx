import { motion } from "framer-motion";
import { ArrowRight, Feather, NotebookPen } from "lucide-react";
import { Link } from "react-router";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

const steps = [
  {
    numeral: "I.",
    title: "Note it",
    body: "Write today's reading, problem set, or revision task into your ledger — one honest line at a time.",
  },
  {
    numeral: "II.",
    title: "Work it",
    body: "Keep the ledger open while you study. It remembers every entry so you don't have to.",
  },
  {
    numeral: "III.",
    title: "Mark it done",
    body: "Press the seal when the work is finished. The entry is filed away, and your mind is clear.",
  },
];

const sampleEntries = [
  { text: "Read Ch. 4 of Biology, take margin notes", done: true },
  { text: "Problem set 6 — questions 1 through 12", done: true },
  { text: "Outline essay: “The Long Nineteenth Century”", done: false },
  { text: "Review Spanish vocabulary, 20 minutes", done: false },
];

function Ornament({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center gap-3 text-accent/70 ${className}`}
    >
      <span className="h-px w-16 bg-border" />
      <span className="text-sm">❦</span>
      <span className="h-px w-16 bg-border" />
    </div>
  );
}

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Aged edge vignette */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 vignette"
      />

      {/* ── Masthead bar ─────────────────────────────────────────── */}
      <header className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full border-2 border-primary/60 font-display text-sm font-semibold text-primary">
              SL
            </span>
            <span className="font-display text-lg font-semibold tracking-wide">
              The Student Ledger
            </span>
          </div>
          <Link
            to="/auth"
            className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-3xl px-6 pb-16 pt-20 text-center sm:pt-24">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground"
          >
            Est. MMXXVI · For the diligent student
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
          >
            Tasks, noted &amp; <span className="italic text-accent">done</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            A quiet, well-kept place to write down what your studies demand of
            you — and the small satisfaction of striking each line through
            when it is finished.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link
              to="/auth"
              className="group inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-7 text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <NotebookPen className="size-4" />
              Begin your ledger
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how-it-works"
              className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
            >
              See how it works
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mt-6 font-hand text-lg text-muted-foreground"
          >
            no fuss — add a task, check it off
          </motion.p>
        </section>

        <Ornament />

        {/* ── How it works ─────────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="mx-auto w-full max-w-5xl px-6 py-16"
        >
          <motion.div {...fadeUp} className="text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              How the ledger is kept
            </h2>
            <p className="mt-2 text-muted-foreground">
              Three movements, as old as study itself.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.numeral}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.12 }}
                className="relative border-t border-border/70 pt-6 text-center sm:text-left"
              >
                <span className="font-display text-2xl font-semibold italic text-accent/80">
                  {step.numeral}
                </span>
                <h3 className="mt-3 font-display text-xl font-semibold">
                  {step.title}
                </h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Sample ledger ────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-3xl px-6 pb-20">
          <motion.div
            {...fadeUp}
            className="rounded-sm border border-border/80 bg-card p-6 shadow-sm sm:p-8"
          >
            <div className="double-rule pb-3 text-center">
              <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
                Folio 12 · This week's entries
              </p>
            </div>
            <ul className="mt-4 space-y-3.5">
              {sampleEntries.map((entry, i) => (
                <li
                  key={entry.text}
                  className="flex items-baseline gap-4 text-[15px]"
                >
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground/80">
                    {String(i + 1).padStart(3, "0")}
                  </span>
                  <span
                    className={`flex-1 border-b border-dotted border-border/80 pb-1 leading-relaxed ${
                      entry.done
                        ? "text-muted-foreground/70 line-through decoration-accent/60 decoration-2"
                        : ""
                    }`}
                  >
                    {entry.text}
                  </span>
                  <span
                    aria-label={entry.done ? "Done" : "Open"}
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 self-center text-[10px] font-bold ${
                      entry.done
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.p
            {...fadeUp}
            className="mt-4 text-center text-sm italic text-muted-foreground"
          >
            An entry from a well-kept ledger.
          </motion.p>
        </section>

        {/* ── Word from a student ──────────────────────────────────── */}
        <section className="border-y border-border/70 bg-secondary/50">
          <motion.blockquote
            {...fadeUp}
            className="mx-auto w-full max-w-2xl px-6 py-14 text-center"
          >
            <Feather className="mx-auto size-5 text-accent/70" />
            <p className="mt-4 font-display text-2xl italic leading-relaxed">
              “I stopped forgetting assignments the week I started keeping the
              ledger. Ten seconds a day.”
            </p>
            <footer className="mt-4 text-sm uppercase tracking-[0.2em] text-muted-foreground">
              — A second-year student
            </footer>
          </motion.blockquote>
        </section>

        {/* ── Closing CTA ──────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-2xl px-6 py-20 text-center">
          <motion.div {...fadeUp}>
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Your first entry takes ten seconds.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Open your ledger, write one task, and mark it done before the
              ink dries.
            </p>
            <Link
              to="/auth"
              className="mt-8 inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-7 text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <NotebookPen className="size-4" />
              Open your ledger
            </Link>
          </motion.div>
        </section>
      </main>

      {/* ── Colophon ─────────────────────────────────────────────── */}
      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>© MMXXVI The Student Ledger</p>
          <p className="italic">Printed carefully in the browser.</p>
        </div>
      </footer>
    </div>
  );
}
