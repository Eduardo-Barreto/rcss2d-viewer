import { Link } from '@tanstack/react-router'
import { ArrowRight, FileUp, Moon, Play, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { APP_PATH } from '@/player/app-route'
import { cycleAt } from '@/player/format'

import { type Clip, clipLink } from './clip'
import { ClipCanvas } from './clip-canvas'
import type { FrameWindow } from './clip-windows'
import { COPY as APP_COPY, type Locale } from './copy'
import { CopyProvider } from './copy-context'
import { useCopy } from './copy-state'
import { LayersDemo, MomentsDemo, StatsDemo } from './demos'
import { Comparison, KeysFigure, LinkFigure, LiveFigure, SafetyFacts } from './figures'
import { COPY_BY_LOCALE } from './locales'
import { PitchFrame } from './pitch-frame'
import { useClip } from './use-clip'
import { useOpenLog } from './use-open-log'

/** The language of every page outside the landing: the replay app is Portuguese. */
const APP_LANG = APP_COPY.lang
const heroSpan = (clip: Clip): FrameWindow => clip.hero
const PAGE = 'mx-auto w-full max-w-[1120px] px-5 md:px-8'
const LEAD = 'text-[15px] leading-6 text-pretty text-muted-foreground'

function ThemeToggle() {
  const copy = useCopy()
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  const label = dark ? copy.nav.light : copy.nav.dark
  return (
    <Button
      aria-label={label}
      className="size-9 rounded-[10px]"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      size="icon"
      title={label}
      variant="ghost"
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  )
}

function Header() {
  const copy = useCopy()
  const { language } = copy.nav
  return (
    <header className={`${PAGE} flex h-16 items-center justify-between`}>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">{copy.brand}</span>
      <nav aria-label={copy.nav.label} className="flex items-center gap-1">
        <ThemeToggle />
        <Button asChild className="h-9 rounded-[10px] px-3 text-[13px]" variant="ghost">
          <Link hrefLang={language.lang} lang={language.lang} to={language.path}>
            {language.text}
          </Link>
        </Button>
        <Button asChild className="h-9 rounded-[10px] px-3 text-[13px]" variant="ghost">
          <Link to={APP_PATH}>
            {copy.nav.app}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </nav>
    </header>
  )
}

/** The primary action, a button that opens the page's one file input. */
function PickButton({ onPick }: { onPick: () => void }) {
  const copy = useCopy()
  return (
    <Button className="h-11 rounded-[12px] px-4 text-[14px]" onClick={onPick}>
      <FileUp aria-hidden />
      {copy.hero.pick}
    </Button>
  )
}

/** Props of {@link Hero}. */
interface HeroProps {
  clip: Clip | null
  failed: boolean
  onPick: () => void
}

function Hero({ clip, failed, onPick }: HeroProps) {
  const copy = useCopy()
  const [frame, setFrame] = useState(-1)
  const cycle = clip === null || frame < 0 ? null : cycleAt(clip.match, frame)

  return (
    <section
      aria-labelledby="hero-title"
      className={`${PAGE} grid grid-cols-1 items-center gap-8 pt-6 pb-16 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 md:pt-12 md:pb-24`}
    >
      <div className="flex flex-col items-start gap-5">
        <h1
          className="text-[34px] leading-[1.08] font-semibold tracking-[-0.025em] text-balance md:text-[46px]"
          id="hero-title"
        >
          {copy.hero.title}
        </h1>
        <p className={`${LEAD} max-w-[44ch] md:text-[16px] md:leading-7`}>{copy.hero.lead}</p>
        <div className="flex flex-wrap items-center gap-2">
          <PickButton onPick={onPick} />
          <Button asChild className="h-11 rounded-[12px] px-4 text-[14px]" variant="secondary">
            <a href={clipLink()}>
              <Play aria-hidden />
              {copy.hero.openClip}
            </a>
          </Button>
        </div>
        <p className="text-[13px] text-muted-foreground">{copy.hero.drop}</p>
      </div>
      <figure className="flex flex-col gap-3">
        <PitchFrame>
          <ClipCanvas clip={clip} onFrame={setFrame} span={heroSpan} />
          <p className="absolute bottom-3 left-3 rounded-[8px] bg-card px-2 py-1 font-mono text-[12px] shadow-island tabular-nums">
            {failed ? copy.error : null}
            {!failed && cycle === null ? copy.hero.loading : null}
            {cycle === null ? null : `${copy.hero.cycle} ${cycle}`}
          </p>
        </PitchFrame>
        <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13px]">
          <span>
            <span className="font-medium">{copy.hero.match}</span>
            <span className="text-muted-foreground"> · {copy.hero.score}</span>
          </span>
          <span className="text-muted-foreground">{copy.hero.figure}</span>
        </figcaption>
      </figure>
    </section>
  )
}

/** Props of {@link Section}. */
interface SectionProps {
  id: string
  title: string
  body: string
  children: ReactNode
  /** Puts the figure under the text instead of beside it. */
  stacked?: boolean
}

function Section({ id, title, body, children, stacked = false }: SectionProps) {
  return (
    <section
      aria-labelledby={id}
      className={`${PAGE} grid grid-cols-1 gap-6 border-t border-border py-14 md:py-20 ${stacked ? '' : 'md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-12'}`}
    >
      <div className="flex flex-col gap-3">
        <h2
          className="text-[24px] leading-8 font-semibold tracking-[-0.015em] text-balance md:text-[28px] md:leading-9"
          id={id}
        >
          {title}
        </h2>
        <p className={`${LEAD} max-w-[52ch]`}>{body}</p>
      </div>
      {children}
    </section>
  )
}

function DropOverlay({ dragging }: { dragging: boolean }) {
  const copy = useCopy()
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-3 z-30 grid place-items-center rounded-[22px] border-2 border-dashed border-foreground/40 bg-background/70 opacity-0 transition-opacity duration-100 ease-(--ease-out) data-on:opacity-100 data-on:duration-150"
      data-on={dragging ? '' : undefined}
    >
      <p className="rounded-[10px] bg-card px-3 py-2 text-[13px] font-medium shadow-island">
        {copy.hero.dropping}
      </p>
    </div>
  )
}

/** The landing page in one language: what the viewer does, shown on a real match. */
export function Landing({ locale = 'pt-BR' }: { locale?: Locale }) {
  const copy = COPY_BY_LOCALE[locale]
  return (
    <CopyProvider copy={copy}>
      <LandingPage />
    </CopyProvider>
  )
}

function LandingPage() {
  const copy = useCopy()
  const { clip, failed } = useClip(copy.moments.labels)
  const { openFiles, dragging } = useOpenLog()
  const input = useRef<HTMLInputElement>(null)
  const pick = () => input.current?.click()

  useEffect(() => {
    const { title } = document
    document.title = copy.title
    document.documentElement.lang = copy.lang
    return () => {
      document.title = title
      document.documentElement.lang = APP_LANG
    }
  }, [copy])

  return (
    <div className="min-h-svh bg-background">
      <Header />
      <main>
        <Hero clip={clip} failed={failed} onPick={pick} />
        <Section body={copy.moments.body} id="lances" title={copy.moments.title}>
          <MomentsDemo clip={clip} />
        </Section>
        <Section body={copy.layers.body} id="camadas" title={copy.layers.title}>
          <LayersDemo clip={clip} />
        </Section>
        <Section body={copy.stats.body} id="numeros" title={copy.stats.title}>
          <StatsDemo clip={clip} />
        </Section>
        <Section body={copy.link.body} id="link" title={copy.link.title}>
          <LinkFigure href={clipLink()} />
        </Section>
        <Section body={copy.keys.body} id="teclado" title={copy.keys.title}>
          <KeysFigure />
        </Section>
        <Section body={copy.live.body} id="ao-vivo" title={copy.live.title}>
          <LiveFigure />
        </Section>
        <Section body={copy.safety.body} id="seguranca" stacked title={copy.safety.title}>
          <SafetyFacts />
        </Section>
        <Section body={copy.comparison.body} id="comparacao" stacked title={copy.comparison.title}>
          <Comparison />
        </Section>
        <section
          aria-labelledby="fim"
          className={`${PAGE} flex flex-col items-start gap-4 border-t border-border py-16 md:py-24`}
        >
          <h2 className="text-[28px] leading-9 font-semibold tracking-[-0.015em]" id="fim">
            {copy.closing.title}
          </h2>
          <p className={LEAD}>{copy.closing.body}</p>
          <PickButton onPick={pick} />
        </section>
      </main>
      <footer className={`${PAGE} border-t border-border py-8 text-[12px] text-muted-foreground`}>
        <p>{copy.footer.text}</p>
        {copy.footer.appNote === '' ? null : <p className="mt-1">{copy.footer.appNote}</p>}
        <p className="mt-1">
          <a className="underline underline-offset-2" href={copy.footer.tapoutHref}>
            {copy.footer.tapout}
          </a>
        </p>
      </footer>
      <input
        accept=".rcg,.gz,application/gzip"
        aria-label={copy.hero.input}
        className="hidden"
        onChange={(event) => openFiles(event.target.files)}
        ref={input}
        tabIndex={-1}
        type="file"
      />
      <DropOverlay dragging={dragging} />
    </div>
  )
}
