import { ArrowRight, Link2 } from 'lucide-react'
import { Fragment } from 'react'

import { cn } from '@/lib/utils'
import { SHORTCUTS, type Shortcut } from '@/player/keys'

import { COPY, type ComparisonRow, type Support } from './copy'

const CAPTION = 'text-[13px] text-muted-foreground'

function Keys({ shortcut }: { shortcut: Shortcut }) {
  return (
    <span className="flex flex-wrap items-center justify-end gap-1">
      {shortcut.keys.map((combo, index) => (
        <Fragment key={combo.join('+')}>
          {index > 0 ? <span className="px-0.5 text-[12px] text-muted-foreground">ou</span> : null}
          {combo.map((key) => (
            <kbd
              className="min-w-6 rounded-[6px] bg-muted px-1.5 py-0.5 text-center font-mono text-[12px]"
              key={key}
            >
              {key}
            </kbd>
          ))}
        </Fragment>
      ))}
    </span>
  )
}

/** The replay's own shortcut list, so the page never drifts from the app. */
export function KeysFigure() {
  return (
    <figure className="flex flex-col gap-3">
      <dl className="flex flex-col rounded-[18px] bg-card px-5 py-3 text-[13px] shadow-island">
        {SHORTCUTS.map((shortcut) => (
          <div
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-border py-2 last:border-b-0"
            key={shortcut.label}
          >
            <dt>{shortcut.label}</dt>
            <dd className="ml-auto">
              <Keys shortcut={shortcut} />
            </dd>
          </div>
        ))}
      </dl>
      <figcaption className={CAPTION}>{COPY.keys.figure}</figcaption>
    </figure>
  )
}

/** The address that opens the final at the goal, as a real link. */
export function LinkFigure({ href }: { href: string }) {
  const [address, cycle] = href.split('#')
  return (
    <figure className="flex flex-col gap-3">
      <a
        className="flex items-center gap-2 rounded-[14px] bg-card px-3 py-2.5 shadow-island transition-shadow duration-150 ease-(--ease-out) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-fine:hover:shadow-artboard"
        href={href}
      >
        <Link2 aria-hidden className="size-4 flex-none text-muted-foreground" />
        <code className="min-w-0 flex-1 font-mono text-[12px] leading-5 break-all">
          {address}
          {cycle === undefined ? null : (
            <mark className="rounded-[4px] bg-foreground px-1 text-background">#{cycle}</mark>
          )}
        </code>
      </a>
      <figcaption className={CAPTION}>{COPY.link.figure}</figcaption>
    </figure>
  )
}

/** Server, relay and browser, the path a live match takes. */
export function LiveFigure() {
  return (
    <figure className="flex flex-col gap-3">
      <ol className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
        {COPY.live.steps.map((step, index) => (
          <li className="contents" key={step.name}>
            {index > 0 ? (
              <ArrowRight
                aria-hidden
                className="size-4 flex-none self-center text-muted-foreground max-md:rotate-90"
              />
            ) : null}
            <div className="flex flex-1 flex-col gap-0.5 rounded-[14px] bg-card px-4 py-3 shadow-island">
              <span className="font-mono text-[13px] font-medium">{step.name}</span>
              <span className="text-[12px] text-muted-foreground">{step.detail}</span>
            </div>
          </li>
        ))}
      </ol>
      <figcaption className={CAPTION}>{COPY.live.figure}</figcaption>
    </figure>
  )
}

/** The limits that keep a bad file from hurting the tab. */
export function SafetyFacts() {
  return (
    <ul className="grid gap-x-8 gap-y-2 text-[15px] leading-6 md:grid-cols-2">
      {COPY.safety.facts.map((fact) => (
        <li className="flex items-baseline gap-3" key={fact}>
          <span
            aria-hidden
            className="size-1.5 flex-none translate-y-[-2px] rounded-full bg-foreground"
          />
          {fact}
        </li>
      ))}
    </ul>
  )
}

const MARK: Record<Support, string> = {
  yes: 'bg-foreground',
  partial: 'bg-foreground/45',
  no: 'border border-foreground/40',
}

const SUPPORTS: Support[] = ['yes', 'partial', 'no']

function Legend() {
  const { comparison } = COPY
  return (
    <ul
      aria-label={comparison.legend}
      className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground"
    >
      {SUPPORTS.map((support) => (
        <li className="flex items-center gap-1.5" key={support}>
          <span aria-hidden className={cn('size-2 rounded-full', MARK[support])} />
          {comparison.support[support]}
        </li>
      ))}
    </ul>
  )
}

function Cell({ value }: { value: ComparisonRow['viewer'] }) {
  return (
    <td className="relative py-2.5 pr-3 pl-7 align-top">
      <span
        aria-hidden
        className={cn('absolute top-[15px] left-3 size-2 rounded-full', MARK[value.support])}
      />
      <span className="sr-only">{COPY.comparison.support[value.support]}. </span>
      {value.text}
    </td>
  )
}

/** The comparison with rcssmonitor, rows where it wins included. */
export function Comparison() {
  const { comparison } = COPY
  return (
    <div className="flex flex-col gap-3">
      <Legend />
      <div className="overflow-x-auto rounded-[18px] bg-card shadow-island">
        <table className="w-full border-collapse text-left text-[13px]">
          <caption className="sr-only">{comparison.caption}</caption>
          <thead>
            <tr className="border-b border-border text-[12px] text-muted-foreground">
              <th className="w-[34%] px-3 py-2.5 font-medium" scope="col">
                {comparison.feature}
              </th>
              <th className="px-3 py-2.5 font-medium text-foreground" scope="col">
                {comparison.viewer}
              </th>
              <th className="px-3 py-2.5 font-medium" scope="col">
                {comparison.monitor}
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr className="border-b border-border last:border-b-0" key={row.feature}>
                <th className="px-3 py-2.5 align-top font-medium" scope="row">
                  {row.feature}
                  {'live' in row ? <span className="text-muted-foreground"> *</span> : null}
                </th>
                <Cell value={row.viewer} />
                <Cell value={row.monitor} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={CAPTION}>
        <span aria-hidden>* </span>
        {comparison.liveNote}
      </p>
    </div>
  )
}
