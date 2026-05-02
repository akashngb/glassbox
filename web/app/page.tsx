import Link from "next/link";
import { HeroFlow } from "@/components/hero-flow";

const REPO_URL = "https://github.com/akashngb/glassbox";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <BackgroundStreak />

      <header className="relative z-10 mx-auto w-full max-w-[1280px] px-6 py-6 lg:px-12 lg:py-8">
        <nav className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[15px] font-medium tracking-tight text-foreground"
          >
            glassbox
          </Link>
          <ul className="hidden items-center gap-8 text-[13px] text-zinc-400 md:flex">
            {["Product", "Docs", "Pricing", "Company"].map((item) => (
              <li key={item}>
                <Link
                  href="#"
                  className="transition-colors hover:text-foreground"
                >
                  {item}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-4">
            <Link
              href="#"
              className="hidden text-[13px] text-zinc-400 transition-colors hover:text-foreground sm:inline"
            >
              Log in
            </Link>
            <Link
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center rounded-full bg-white px-4 text-[13px] font-medium text-black transition-colors hover:bg-white/90"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-1 items-start px-6 pt-12 pb-24 lg:items-center lg:px-12 lg:pt-12 lg:pb-28">
        <div className="grid w-full grid-cols-1 items-center gap-16 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <AnnouncementPill />

            <h1 className="mt-7 font-display text-[44px] leading-[0.95] tracking-[-0.025em] text-white sm:text-[60px] lg:text-[88px]">
              Models you can<br />
              see through.
            </h1>

            <p className="mt-7 max-w-[480px] text-[15px] leading-[1.55] text-zinc-400">
              Trace every datapoint, inspect every parameter, measure every bias
              your model carries. Glassbox brings machine learning into focus.
            </p>

            <div className="mt-9 flex items-center gap-6">
              <Link
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-full bg-white px-5 text-[13.5px] font-medium text-black transition-colors hover:bg-white/90"
              >
                Get started
              </Link>
              <Link
                href="#"
                className="text-[13.5px] text-zinc-300 transition-colors hover:text-white"
              >
                Documentation
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[420px] lg:col-span-5 lg:max-w-none">
            <HeroFlow />
          </div>
        </div>
      </main>
    </div>
  );
}

function AnnouncementPill() {
  return (
    <Link
      href="#"
      className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.025] px-3 py-1 text-[12px] text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
    >
      Bias is a visibility problem
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        className="text-zinc-500 transition-colors group-hover:text-zinc-300"
        aria-hidden
      >
        <path
          d="M3.5 2L6.5 5L3.5 8"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}

function BackgroundStreak() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[24%] h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[8%] h-56 bg-gradient-to-t from-transparent via-white/[0.07] to-transparent blur-3xl"
      />
    </>
  );
}
