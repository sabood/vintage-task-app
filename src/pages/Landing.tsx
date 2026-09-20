import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Plus,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

const features = [
  {
    icon: Plus,
    title: "Quick capture",
    body: "Add a task the moment you think of it — type it in and press enter. That's the whole workflow.",
  },
  {
    icon: CheckCircle2,
    title: "One tap to done",
    body: "Check items off as you finish them. Completed tasks fade back politely instead of nagging you.",
  },
  {
    icon: TrendingUp,
    title: "Progress at a glance",
    body: "A live tally of what's done and what's still open, so you always know where the day stands.",
  },
];

const previewTasks = [
  { text: "Read Ch. 4 of Biology", done: true },
  { text: "Problem set 6, questions 1–12", done: true },
  { text: "Outline essay draft", done: false },
  { text: "Review Spanish vocabulary", done: false },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top nav ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Check className="size-4" strokeWidth={3} />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              Slate
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#how-it-works"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              How it works
            </a>
            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-48 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative mx-auto w-full max-w-3xl px-6 pb-16 pt-20 text-center sm:pt-24">
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm"
            >
              <Sparkles className="size-3.5 text-primary" />
              Built for students
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="mt-6 font-display text-5xl font-bold tracking-tight sm:text-6xl"
            >
              Stay on top of{" "}
              <span className="text-primary">every task</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
            >
              Slate is a focused to-do app for students. Add what's due, check
              it off, and see your progress at a glance — nothing else to
              learn.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl px-7 text-base shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <Link to="/auth">
                  Get started free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <a
                href="#how-it-works"
                className="rounded-xl px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                See how it works
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="mt-6 text-sm text-muted-foreground"
            >
              Free · No setup · Add a task in seconds
            </motion.p>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────── */}
        <section
          id="how-it-works"
          className="mx-auto w-full max-w-6xl px-6 py-16"
        >
          <motion.div {...fadeUp} className="text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              How it works
            </h2>
            <p className="mt-2 text-muted-foreground">
              Three steps. No learning curve.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.12 }}
                className="rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.body}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── App preview ───────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-2xl px-6 pb-20">
          <motion.div
            {...fadeUp}
            className="overflow-hidden rounded-2xl border bg-card shadow-xl"
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <p className="font-medium">Today</p>
              <p className="text-xs text-muted-foreground">4 tasks</p>
            </div>
            <ul className="divide-y divide-border/70">
              {previewTasks.map((task) => (
                <li key={task.text} className="flex items-center gap-3 px-5 py-3.5">
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                      task.done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {task.done && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span
                    className={
                      task.done
                        ? "text-[15px] text-muted-foreground line-through"
                        : "text-[15px]"
                    }
                  >
                    {task.text}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.p
            {...fadeUp}
            className="mt-4 text-center text-sm text-muted-foreground"
          >
            Your day at a glance.
          </motion.p>
        </section>

        {/* ── Testimonial ───────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-3xl px-6 pb-20">
          <motion.figure
            {...fadeUp}
            className="rounded-2xl border bg-card p-8 text-center shadow-sm"
          >
            <blockquote className="text-xl font-medium leading-relaxed">
              “Slate replaced the sticky notes all over my desk. Ten seconds to
              add a task, one tap when it's done.”
            </blockquote>
            <figcaption className="mt-5 flex items-center justify-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                M
              </span>
              <span className="text-sm text-muted-foreground">
                Maya · second-year student
              </span>
            </figcaption>
          </motion.figure>
        </section>

        {/* ── Closing CTA ───────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-5xl px-6 pb-24">
          <motion.div
            {...fadeUp}
            className="rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground shadow-lg"
          >
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Ready to clear your head?
            </h2>
            <p className="mx-auto mt-3 max-w-md opacity-80">
              Write down what's due, finish it, and check it off. Your first
              task takes ten seconds.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 h-12 rounded-xl bg-white px-7 text-base text-zinc-900 shadow-md transition-all hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-lg"
            >
              <Link to="/auth">
                Open Slate free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </motion.div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 text-sm text-muted-foreground sm:flex-row">
          <p>© 2026 Slate</p>
          <p>Made for students.</p>
        </div>
      </footer>
    </div>
  );
}
