#!/usr/bin/env bun
/**
 * Post-build step: turns `dist/index.html`, the empty shell Vite emits, into one HTML file per
 * route, each with its own title, description, canonical and social tags, and the landing page
 * with its real text inside `#root`. There is no server rendering and no hydration: `createRoot`
 * replaces that text when the bundle runs, so what a crawler or a visitor without JavaScript
 * reads is what the page says once it is up.
 *
 *   bun scripts/prerender.ts [dist-dir]
 *
 * Cloudflare Pages serves a root `404.html` with status 404 for any path without a file and
 * stops falling back to the SPA shell, so every real route needs a file of its own: `/` is
 * `index.html` and `/app` is `app.html`.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { GOAL_CYCLE } from '@/components/landing/clip-windows'
import { COPY, type ComparisonRow } from '@/components/landing/copy'
import { buttonVariants } from '@/components/ui/button'
import { APP_PATH } from '@/player/app-route'
import { addressOf } from '@/player/deep-link'

/** Origin the site is served from, the host of every canonical and `og:url`. */
export const SITE = 'https://rcssviewer.tapout.gg'

const OG_IMAGE = `${SITE}/og.png`
const OG_ALT =
  'O replay de uma partida da RoboCup Soccer Simulation 2D no rcssviewer, com o painel de números dos dois times.'
const SHELL_TITLE = '<title>rcssviewer</title>'
const ROOT = '<div id="root"></div>'

/** Everything that differs between the head of two routes. */
export interface PageHead {
  title: string
  description: string
  /** Path of the canonical URL, or null for a page that has none. */
  canonical: string | null
  noindex: boolean
  /** Whether the page carries `og:*` and `twitter:*` tags. */
  social: boolean
  /** JSON-LD objects, one `<script>` each. */
  jsonLd: readonly object[]
}

/** Escapes text for an HTML text node or a double-quoted attribute. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Serializes JSON-LD so a `<` in a value can never close the script element. */
export function jsonLdScript(node: object): string {
  const json = JSON.stringify(node).replaceAll('<', '\\u003c')
  return `<script type="application/ld+json">${json}</script>`
}

const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: COPY.brand,
  alternateName: 'rcss2d-viewer',
  url: `${SITE}/`,
}

/** The head of each route, keyed by the file it is written to. */
export const PAGES: Record<'index' | 'app' | '404', PageHead> = {
  index: {
    title: COPY.title,
    description: COPY.description,
    canonical: '/',
    noindex: false,
    social: true,
    jsonLd: [WEBSITE_JSON_LD],
  },
  app: {
    title: `Replay de partida .rcg | ${COPY.brand}`,
    description: COPY.description,
    canonical: APP_PATH,
    noindex: true,
    social: true,
    jsonLd: [],
  },
  '404': {
    title: `Página não encontrada | ${COPY.brand}`,
    description: 'A página que você pediu não existe.',
    canonical: null,
    noindex: true,
    social: false,
    jsonLd: [],
  },
}

/** The `<title>` and `<meta>`, `<link>` and JSON-LD tags that replace the shell's `<title>`. */
export function headTags(page: PageHead): string {
  const tags = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
  ]
  if (page.noindex) tags.push('<meta name="robots" content="noindex" />')
  if (page.canonical !== null) {
    tags.push(
      `<link rel="canonical" href="${SITE}${page.canonical === '/' ? '/' : page.canonical}" />`,
    )
  }
  if (page.social) {
    const url = `${SITE}${page.canonical ?? '/'}`
    const og: [string, string][] = [
      ['og:type', 'website'],
      ['og:site_name', COPY.brand],
      ['og:locale', 'pt_BR'],
      ['og:title', page.title],
      ['og:description', page.description],
      ['og:url', url],
      ['og:image', OG_IMAGE],
      ['og:image:width', '1200'],
      ['og:image:height', '630'],
      ['og:image:alt', OG_ALT],
    ]
    for (const [property, content] of og) {
      tags.push(`<meta property="${property}" content="${escapeHtml(content)}" />`)
    }
    const twitter: [string, string][] = [
      ['twitter:card', 'summary_large_image'],
      ['twitter:title', page.title],
      ['twitter:description', page.description],
      ['twitter:image', OG_IMAGE],
      ['twitter:image:alt', OG_ALT],
    ]
    for (const [name, content] of twitter) {
      tags.push(`<meta name="${name}" content="${escapeHtml(content)}" />`)
    }
  }
  for (const node of page.jsonLd) tags.push(jsonLdScript(node))
  return tags.join('\n    ')
}

const PAGE = 'mx-auto w-full max-w-[1120px] px-5 md:px-8'
const LEAD = 'text-[15px] leading-6 text-pretty text-muted-foreground'

function section(id: string, title: string, body: string, extra = ''): string {
  return `<section aria-labelledby="${id}" class="${PAGE} grid grid-cols-1 gap-6 border-t border-border py-14 md:py-20">
<div class="flex flex-col gap-3">
<h2 class="text-[24px] leading-8 font-semibold tracking-[-0.015em] text-balance md:text-[28px] md:leading-9" id="${id}">${escapeHtml(title)}</h2>
<p class="${LEAD} max-w-[52ch]">${escapeHtml(body)}</p>
</div>${extra}
</section>`
}

function cell(value: ComparisonRow['viewer']): string {
  return `<td class="py-2.5 pr-3 pl-3 align-top"><span class="sr-only">${escapeHtml(COPY.comparison.support[value.support])}. </span>${escapeHtml(value.text)}</td>`
}

function comparisonTable(): string {
  const { comparison } = COPY
  const rows = comparison.rows
    .map(
      (row) =>
        `<tr class="border-b border-border last:border-b-0"><th class="px-3 py-2.5 align-top font-medium" scope="row">${escapeHtml(row.feature)}${'live' in row ? ' *' : ''}</th>${cell(row.viewer)}${cell(row.monitor)}</tr>`,
    )
    .join('')
  return `<div class="flex flex-col gap-3"><div class="overflow-x-auto rounded-[18px] bg-card shadow-island">
<table class="w-full border-collapse text-left text-[13px]"><caption class="sr-only">${escapeHtml(comparison.caption)}</caption>
<thead><tr class="border-b border-border text-[12px] text-muted-foreground"><th class="w-[34%] px-3 py-2.5 font-medium" scope="col">${escapeHtml(comparison.feature)}</th><th class="px-3 py-2.5 font-medium text-foreground" scope="col">${escapeHtml(comparison.viewer)}</th><th class="px-3 py-2.5 font-medium" scope="col">${escapeHtml(comparison.monitor)}</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<p class="text-[13px] text-muted-foreground">* ${escapeHtml(comparison.liveNote)}</p></div>`
}

function factsList(): string {
  const items = COPY.safety.facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join('')
  return `<ul class="grid max-w-[720px] gap-x-8 gap-y-2 text-[15px] leading-6 md:grid-cols-2 list-disc pl-5">${items}</ul>`
}

/**
 * The landing page's text and links as plain HTML, styled by the bundle's CSS. The figures that
 * need the clip and a canvas are left to the client, which is why they have no markup here.
 */
export function landingHtml(clipUrl: string): string {
  const clipHref = `${SITE}${addressOf(APP_PATH, { url: `${SITE}${clipUrl}`, live: null }, GOAL_CYCLE)}`
  const { hero } = COPY
  return `<div class="min-h-svh bg-background">
<header class="${PAGE} flex h-16 items-center justify-between">
<span class="text-[15px] font-semibold tracking-[-0.01em]">${escapeHtml(COPY.brand)}</span>
<nav aria-label="${escapeHtml(COPY.nav.label)}"><a class="${buttonVariants({ variant: 'ghost', className: 'h-9 rounded-[10px] px-3 text-[13px]' })}" href="${APP_PATH}">${escapeHtml(COPY.nav.app)}</a></nav>
</header>
<main>
<section aria-labelledby="hero-title" class="${PAGE} flex flex-col items-start gap-5 pt-6 pb-16 md:pt-12 md:pb-24">
<h1 class="text-[34px] leading-[1.08] font-semibold tracking-[-0.025em] text-balance md:text-[46px]" id="hero-title">${escapeHtml(hero.title)}</h1>
<p class="${LEAD} max-w-[44ch] md:text-[16px] md:leading-7">${escapeHtml(hero.lead)}</p>
<a class="${buttonVariants({ variant: 'secondary', className: 'h-11 rounded-[12px] px-4 text-[14px]' })}" href="${escapeHtml(clipHref)}">${escapeHtml(hero.openClip)}</a>
</section>
${section('lances', COPY.moments.title, COPY.moments.body)}
${section('camadas', COPY.layers.title, COPY.layers.body)}
${section('numeros', COPY.stats.title, COPY.stats.body)}
${section('link', COPY.link.title, COPY.link.body)}
${section('teclado', COPY.keys.title, COPY.keys.body)}
${section('ao-vivo', COPY.live.title, COPY.live.body)}
${section('seguranca', COPY.safety.title, COPY.safety.body, factsList())}
${section('comparacao', COPY.comparison.title, COPY.comparison.body, comparisonTable())}
<section aria-labelledby="fim" class="${PAGE} flex flex-col items-start gap-4 border-t border-border py-16 md:py-24">
<h2 class="text-[28px] leading-9 font-semibold tracking-[-0.015em]" id="fim">${escapeHtml(COPY.closing.title)}</h2>
<a class="${buttonVariants({ variant: 'ghost', className: 'h-11 rounded-[12px] px-4 text-[14px]' })}" href="${APP_PATH}">${escapeHtml(COPY.nav.app)}</a>
</section>
</main>
<footer class="${PAGE} border-t border-border py-8 text-[12px] text-muted-foreground">
<p>${escapeHtml(COPY.footer.text)}</p>
<p class="mt-1"><a class="underline underline-offset-2" href="${COPY.footer.tapoutHref}">${escapeHtml(COPY.footer.tapout)}</a></p>
</footer>
</div>`
}

/** Writes the head of `page` into the shell, and `body` into its empty root when given. */
export function renderPage(shell: string, page: PageHead, body: string | null): string {
  if (!shell.includes(SHELL_TITLE)) throw new Error(`prerender: shell has no ${SHELL_TITLE}`)
  if (!shell.includes(ROOT)) throw new Error(`prerender: shell has no ${ROOT}`)
  const withHead = shell.replace(SHELL_TITLE, () => headTags(page))
  return body === null ? withHead : withHead.replace(ROOT, () => `<div id="root">${body}</div>`)
}

/** The URL path of the example clip Vite emitted, found by its hashed file name. */
export function clipAssetUrl(assets: readonly string[]): string {
  const file = assets.find((name) => /^robocup2026-final\.rcg-.+\.gz$/.test(name))
  if (file === undefined) throw new Error('prerender: the example clip is not in dist/assets')
  return `/assets/${file}`
}

function main(): void {
  const dist = path.resolve(process.argv[2] ?? 'dist')
  const shell = readFileSync(path.join(dist, 'index.html'), 'utf8')
  const clip = clipAssetUrl(readdirSync(path.join(dist, 'assets')))
  const outputs: [string, string][] = [
    ['index.html', renderPage(shell, PAGES.index, landingHtml(clip))],
    ['app.html', renderPage(shell, PAGES.app, null)],
    ['404.html', renderPage(shell, PAGES['404'], null)],
  ]
  for (const [name, html] of outputs) writeFileSync(path.join(dist, name), html)
}

if (import.meta.main) main()
