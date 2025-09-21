"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { HeroBackground } from "@/components/hero-background"

const NAV_ITEMS = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Blog", href: "#blog" },
]

const featureMetrics = [
  { label: "Active sparks", value: "12" },
  { label: "Focus sessions", value: "4 this week" },
  { label: "Automation queue", value: "6 running" },
]

const featureHighlights = [
  {
    tag: "AI co-pilot",
    title: "Guided momentum",
    description:
      "Three launches overlap next week. Spark suggests a shared ritual so timelines stay aligned.",
  },
  {
    tag: "Spark rituals",
    title: "Morning clarity",
    description:
      "Automated standups collect tasks, blockers and fresh nudges into a single digest so you focus faster.",
  },
  {
    tag: "Live collaboration",
    title: "Presence that keeps pace",
    description:
      "Hover avatars, instant threads and reactions keep every spark moving without extra meetings.",
    metrics: [
      { label: "Teammates in canvas", value: "5 right now" },
      { label: "Inline comments", value: "32 resolved" },
    ],
  },
]

const timelineTile = {
  tag: "Timeline view",
  title: "Timebox every spark",
  description: "Drop sparks onto the schedule, stretch durations, and keep priorities visible in one sweep.",
}

const notificationTile = {
  tag: "Notifications",
  title: "Keep up without digging",
  description: "Realtime nudges surface comments, status changes, and upcoming rituals before anything slips.",
  metrics: [
    { label: "Unread alerts", value: "3" },
    { label: "Last sync", value: "2m ago" },
  ],
}

const achievementTile = {
  tag: "Achievement center",
  title: "Progress that stays visible",
  description: "Track streaks, XP, and unlocked milestones so every spark move builds momentum.",
  metrics: [
    { label: "Unlocked", value: "12 / 24" },
    { label: "XP earned", value: "1,480" },
    { label: "Current streak", value: "5 days" },
  ],
}

export default function Home() {
  const [isLight, setIsLight] = useState(true)

  const pageClass = isLight ? "bg-white text-slate-950" : "bg-[#0d0f10] text-white"
  const navLink = isLight ? "text-slate-600 hover:text-slate-950" : "text-white/70 hover:text-white"
  const borderColor = isLight ? "border-slate-200" : "border-white/10"
  const secondaryText = isLight ? "text-slate-600" : "text-white/60"
  const heroSubtitle = isLight ? "text-slate-600" : "text-white/70"

  const goToGuest = () => {
    const params = new URLSearchParams(window.location.search)
    params.set("guest", "1")
    window.location.href = `/app?${params.toString()}`
  }

  const goToLogin = () => {
    window.location.href = "/auth/signin"
  }

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors ${pageClass}`}>
      <header className="relative overflow-hidden">
        <HeroBackground isLight={isLight} />

        <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Image src="/logo.svg" alt="Spark logo" width={32} height={32} className="object-contain" />
            <span>Spark</span>
          </div>

          <div className="hidden items-center gap-8 text-sm font-medium md:flex">
            {NAV_ITEMS.map((item) => (
              <a key={item.label} href={item.href} className={`transition ${navLink}`}>
                {item.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <Button
              variant="outline"
              className={`border ${borderColor} ${isLight ? "bg-white text-slate-800 hover:bg-slate-100" : "bg-transparent text-white/75 hover:text-white"}`}
              onClick={() => setIsLight((v) => !v)}
            >
              {isLight ? "Dark mode" : "Light mode"}
            </Button>
            <Button
              variant="ghost"
              className={`px-4 py-2 text-sm ${isLight ? "text-slate-700 hover:text-slate-950" : "text-white/75 hover:text-white"}`}
              onClick={goToLogin}
            >
              Log in
            </Button>
            <Button
              className={`px-5 py-2 text-sm ${
                isLight
                  ? "bg-[#00ff00] text-black hover:bg-[#00ff00]/90"
                  : "bg-[#00ff00] text-black hover:bg-[#00ff00]/90"
              }`}
              onClick={goToGuest}
            >
              Try Spark free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </nav>

        <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-16 px-6 pb-28 pt-24 text-center lg:items-start lg:text-left">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-12 pt-4"
          >
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.3em] ${
                isLight ? "border-slate-900 bg-slate-900 text-white" : `${borderColor} bg-white/10 text-white/60`
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isLight ? "bg-slate-100" : "bg-white/70"}`}
              /> AI-first workspace
            </div>

            <div className="mt-6 space-y-10">
              <h1 className={`text-4xl font-semibold leading-tight md:text-6xl lg:text-[4.25rem] lg:leading-[1.1] ${isLight ? "text-slate-950" : "text-white"}`}>
                Because genius doesn't
                <br className="hidden sm:block" />
                always strike at your desk.
              </h1>
              <p className={`text-lg lg:text-xl ${heroSubtitle}`}>
                Turn those random sparks into real projects — without losing a single one.
                <br className="hidden sm:block" />
                Ideas don't wait, and now you don't have to either.
              </p>
            </div>

            <div className="mt-20 flex flex-col items-center gap-4 sm:flex-row sm:justify-start">
              <Button
                className={`w-full max-w-xs px-5 py-3 text-sm font-semibold sm:w-auto sm:px-6 ${
                  isLight
                    ? "bg-[#00ff00] text-black hover:bg-[#00ff00]/90"
                    : "bg-[#00ff00] text-black hover:bg-[#00ff00]/90"
                }`}
                onClick={goToGuest}
              >
                Explore as guest
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className={`w-full max-w-xs px-5 py-3 text-sm font-semibold sm:w-auto sm:px-6 ${borderColor} ${
                  isLight ? "bg-white text-slate-800 hover:bg-slate-100" : "bg-transparent text-white hover:bg-white/10"
                }`}
                onClick={goToLogin}
              >
                Log in
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="h-4 sm:h-6" />
          </motion.div>

        </section>
      </header>

      <section className="relative z-10 px-6 py-24" id="features">
        <div className="relative mx-auto flex max-w-6xl flex-col gap-12">
          <div className="flex flex-col gap-6 text-center lg:flex-row lg:items-end lg:justify-between lg:text-left">
            <div className="space-y-4">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs uppercase tracking-widest ${
                  isLight ? "bg-slate-100 text-slate-600" : "bg-white/10 text-white/70"
                }`}
              >
                The grid of possibilities
              </span>
              <h2 className={`text-3xl font-semibold md:text-4xl ${isLight ? "text-slate-900" : "text-white"}`}>
                See how Spark lights up every workflow.
              </h2>
            </div>
            <p className={`max-w-xl text-sm ${secondaryText}`}>
              Spark mirrors the workspace you already love—drag sparks on the canvas, triage in kanban, timebox in
              timeline, and watch every change stay in sync.
            </p>
          </div>

          <div className="flex flex-col gap-10">
            <div className="grid gap-6 lg:grid-cols-12">
              <div
                className={`relative overflow-hidden rounded-[32px] border p-8 lg:col-span-7 ${
                  borderColor
                } ${isLight ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white" : "bg-white/10 text-white"}`}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.18),transparent_70%)] opacity-25" />
                <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-start">
                  <div className="flex-1 space-y-6">
                    <div className="text-xs uppercase tracking-[0.35em] text-[#74ff9e]">Flow map</div>
                    <h3 className="text-2xl font-semibold leading-tight">Keep every view aligned without duplicate work.</h3>
                    <p className="text-sm text-white/70">
                      Drag sparks on the canvas, triage in kanban, timebox in timeline—Spark mirrors each move instantly.
                    </p>
                    <dl className="grid gap-y-4 gap-x-6 text-sm sm:grid-cols-3">
                      {featureMetrics.map((metric) => (
                        <div key={metric.label} className="space-y-1">
                          <dt className="text-white/60">{metric.label}</dt>
                          <dd className="text-base font-semibold text-white">{metric.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="grid w-full gap-4 lg:w-60">
                    <div className="rounded-3xl bg-white/15 px-5 py-4">
                      <p className="text-xs uppercase tracking-wide text-[#74ff9e]">Seedling</p>
                      <p className="mt-2 text-sm font-semibold text-white">Prototype onboarding journey</p>
                      <p className="mt-1 text-xs text-white/60">Due Thu · 3 subtasks</p>
                    </div>
                    <div className="rounded-3xl bg-white/10 px-5 py-4">
                      <p className="text-xs uppercase tracking-wide text-[#74ff9e]">Sapling</p>
                      <p className="mt-2 text-sm font-semibold text-white">Sync marketing & dev launch</p>
                      <p className="mt-1 text-xs text-white/60">Canvas · Assigned to you</p>
                    </div>
                    <div className="rounded-3xl bg-white/15 px-5 py-4 text-slate-900 dark:text-white">
                      <p className="text-xs uppercase tracking-wide text-[#0b6d2d] dark:text-[#98ffbe]">Focus session</p>
                      <p className="mt-2 text-sm font-semibold">Thursday · 09:30</p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`${
                  isLight ? "bg-white text-slate-900" : "bg-white/10 text-white"
                } rounded-[30px] border px-6 py-7 shadow-[0_20px_40px_rgba(15,23,42,0.08)] lg:col-span-5`}
              >
                <p className="text-xs uppercase tracking-widest text-[#00b44b]">{featureHighlights[0].tag}</p>
                <h4 className="mt-3 text-lg font-semibold">{featureHighlights[0].title}</h4>
                <p className={`mt-3 text-sm ${isLight ? "text-slate-600" : "text-white/70"}`}>
                  {featureHighlights[0].description}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              <div
                className={`${
                  isLight ? "bg-white text-slate-900" : "bg-white/10 text-white"
                } rounded-[28px] border px-6 py-7 shadow-[0_18px_32px_rgba(15,23,42,0.08)] lg:col-span-3`}
              >
                <p className="text-xs uppercase tracking-widest text-[#00b44b]">{featureHighlights[1].tag}</p>
                <h4 className="mt-3 text-base font-semibold">{featureHighlights[1].title}</h4>
                <p className={`mt-3 text-sm ${isLight ? "text-slate-600" : "text-white/70"}`}>
                  {featureHighlights[1].description}
                </p>
              </div>
              <div
                className={`${
                  isLight ? "bg-slate-950 text-white" : "bg-white/10 text-white"
                } rounded-[28px] border px-6 py-7 shadow-[0_18px_32px_rgba(15,23,42,0.15)] lg:col-span-6`}
              >
                <p className="text-xs uppercase tracking-widest text-slate-300">{timelineTile.tag}</p>
                <h4 className="mt-3 text-base font-semibold">{timelineTile.title}</h4>
                <p className="mt-3 text-sm text-white/70">{timelineTile.description}</p>
              </div>
              <div
                className={`${
                  isLight ? "bg-white text-slate-900" : "bg-white/10 text-white"
                } rounded-[28px] border px-6 py-7 shadow-[0_18px_32px_rgba(15,23,42,0.08)] lg:col-span-3`}
              >
                <p className="text-xs uppercase tracking-widest text-[#00b44b]">{notificationTile.tag}</p>
                <h4 className="mt-3 text-base font-semibold">{notificationTile.title}</h4>
                <p className={`mt-3 text-sm ${isLight ? "text-slate-600" : "text-white/70"}`}>
                  {notificationTile.description}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {notificationTile.metrics.map((metric) => (
                    <li key={metric.label} className="flex items-center justify-between">
                      <span className={`${isLight ? "text-slate-500" : "text-white/70"}`}>{metric.label}</span>
                      <span className={`${isLight ? "text-slate-900" : "text-white"} font-semibold`}>
                        {metric.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              <div
                className={`${
                  isLight ? "bg-white text-slate-900" : "bg-white/10 text-white"
                } rounded-[30px] border px-6 py-7 shadow-[0_18px_36px_rgba(15,23,42,0.1)] lg:col-span-4`}
              >
                <p className="text-xs uppercase tracking-widest text-[#00b44b]">{featureHighlights[2].tag}</p>
                <h4 className="mt-3 text-lg font-semibold">{featureHighlights[2].title}</h4>
                <p className={`mt-3 text-sm ${isLight ? "text-slate-600" : "text-white/70"}`}>
                  {featureHighlights[2].description}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {featureHighlights[2].metrics?.map((metric) => (
                    <li key={metric.label} className="flex items-center justify-between">
                      <span className={`${isLight ? "text-slate-500" : "text-white/70"}`}>{metric.label}</span>
                      <span className={`${isLight ? "text-slate-900" : "text-white"} font-semibold`}>
                        {metric.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className={`${
                  isLight ? "bg-slate-950 text-white" : "bg-white/10 text-white"
                } rounded-[32px] border px-8 py-8 shadow-[0_24px_48px_rgba(15,23,42,0.25)] lg:col-span-8 lg:col-start-5`}
              >
                <p className="text-xs uppercase tracking-[0.25em] text-[#74ff9e]">{achievementTile.tag}</p>
                <h4 className="mt-4 text-2xl font-semibold">{achievementTile.title}</h4>
                <p className="mt-3 text-sm text-white/70">{achievementTile.description}</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {achievementTile.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-2xl bg-white/10 px-5 py-4 text-center">
                      <div className="text-2xl font-semibold text-white">{metric.value}</div>
                      <div className="text-xs text-white/60">{metric.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr,0.9fr]">
          <div className={`space-y-6 rounded-[28px] border px-8 py-10 ${
            isLight ? 'bg-white' : 'bg-white/10 text-white'
          }`}>
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">Questions</span>
              <h3 className={`text-3xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Everything you need to ship sparks confidently.
              </h3>
            </div>

            <div className="space-y-4">
              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold focus:outline-none group-open:text-slate-900 dark:group-open:text-white">
                  Can I switch between canvas, kanban, and timeline without losing data?
                </summary>
                <p className={`mt-2 text-sm ${isLight ? 'text-slate-600' : 'text-white/70'}`}>
                  Yes. Spark keeps every view in sync, so dragging a spark on the canvas immediately reflects in kanban columns and timelines.
                </p>
              </details>
              <div className={`h-px ${isLight ? 'bg-slate-200' : 'bg-white/15'}`} />
              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold focus:outline-none group-open:text-slate-900 dark:group-open:text-white">
                  How do guest sparks become permanent?
                </summary>
                <p className={`mt-2 text-sm ${isLight ? 'text-slate-600' : 'text-white/70'}`}>
                  Build as a guest, then sign in—Spark migrates your sparks, comments, and streak progress to your account automatically.
                </p>
              </details>
              <div className={`h-px ${isLight ? 'bg-slate-200' : 'bg-white/15'}`} />
              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold focus:outline-none group-open:text-slate-900 dark:group-open:text-white">
                  Can I export data if I need a snapshot?
                </summary>
                <p className={`mt-2 text-sm ${isLight ? 'text-slate-600' : 'text-white/70'}`}>
                  Absolutely. Choose sparks or todos, pick the fields you want, and Spark generates a CSV—perfect for backups or team handoffs.
                </p>
              </details>
            </div>
          </div>

          <div className={`space-y-6 rounded-[28px] border px-8 py-10 ${
            isLight ? 'bg-white shadow-[0_24px_48px_rgba(15,23,42,0.08)]' : 'bg-white/10 text-white'
          }`}>
            <h4 className="text-xl font-semibold">Need something else?</h4>
            <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-white/70'}`}>
              Drop us a note and we’ll help you wire Spark into your workflow. We respond within one business day.
            </p>

            <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
              <input
                className={`w-full rounded-lg border px-4 py-3 text-sm outline-none transition ${
                  isLight
                    ? 'border-slate-200 bg-white focus:border-slate-900'
                    : 'border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-white'
                }`}
                placeholder="Name"
                type="text"
              />
              <input
                className={`w-full rounded-lg border px-4 py-3 text-sm outline-none transition ${
                  isLight
                    ? 'border-slate-200 bg-white focus:border-slate-900'
                    : 'border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-white'
                }`}
                placeholder="Email"
                type="email"
              />
              <textarea
                className={`h-28 w-full rounded-lg border px-4 py-3 text-sm outline-none transition ${
                  isLight
                    ? 'border-slate-200 bg-white focus:border-slate-900'
                    : 'border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-white'
                }`}
                placeholder="Tell us what you’re trying to achieve."
              />
              <button
                type="submit"
                className="w-full rounded-full bg-[#00ff00] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#00ff00]/85"
              >
                Send it over
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer className={`relative z-10 border-t py-12 text-center text-sm ${borderColor} ${secondaryText}`}>
        © 2025 Mesh Studio · Spark. Bring every idea to life.
      </footer>
    </div>
  )
}
