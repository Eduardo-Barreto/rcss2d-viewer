#!/usr/bin/env bun
/**
 * Post-build step: turns `dist/index.html`, the empty shell Vite emits, into one HTML file per
 * route, each with its own title, description, canonical and social tags, and the landing page
 * with its real text inside `#root`. There is no server rendering and no hydration: `createRoot`
 * replaces that text when the bundle runs, so what a crawler or a visitor without JavaScript
 * reads is what the page says once it is up. The markup is written by hand rather than rendered
 * from the React tree (the figures are canvases), so it cannot be hydrated: `public/boot.js`
 * hides it for visitors with JavaScript until the app mounts, and it stays visible without.
 *
 *   bun scripts/prerender.ts [dist-dir]
 *
 * Cloudflare Pages serves a root `404.html` with status 404 for any path without a file and
 * stops falling back to the SPA shell, so every real route needs a file of its own: `/` is
 * `index.html`, `/en` is `en.html` and `/app` is `app.html`.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { GOAL_CYCLE } from '@/components/landing/clip-windows'
import { COPY, type ComparisonRow, type Copy, type Locale } from '@/components/landing/copy'
import { COPY_BY_LOCALE } from '@/components/landing/locales'
import { buttonVariants } from '@/components/ui/button'
import { APP_PATH } from '@/player/app-route'
import { addressOf } from '@/player/deep-link'

/** Origin the site is served from, the host of every canonical and `og:url`. */
export const SITE = 'https://rcssviewer.tapout.gg'

const OG_IMAGE = `${SITE}/og.png`
const SHELL_TITLE = '<title>rcssviewer</title>'
const SHELL_LANG = '<html lang="pt-BR">'
const ROOT = '<div id="root"></div>'

/** Everything that differs between the head of two routes. */
export interface PageHead {
  title: string
  description: string
  /** Path of the canonical URL, or null for a page that has none. */
  canonical: string | null
  noindex: boolean
  /** Language of the page, the `lang` of `<html>`. */
  lang: Locale
  /** Every language version of the page, each listed on all of them as `hreflang` asks. */
  alternates: boolean
  /** Whether the page carries `og:*` and `twitter:*` tags. */
  social: boolean
  /** Locale of `og:locale` and the alt text of the image, which are in the page's language. */
  copy: Copy
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
export const PAGES: Record<'index' | 'en' | 'app' | '404', PageHead> = {
  index: {
    title: COPY.title,
    description: COPY.description,
    canonical: '/',
    noindex: false,
    lang: 'pt-BR',
    alternates: true,
    social: true,
    copy: COPY,
    jsonLd: [WEBSITE_JSON_LD],
  },
  en: {
    title: COPY_BY_LOCALE.en.title,
    description: COPY_BY_LOCALE.en.description,
    canonical: '/en',
    noindex: false,
    lang: 'en',
    alternates: true,
    social: true,
    copy: COPY_BY_LOCALE.en,
    jsonLd: [],
  },
  app: {
    title: `Replay de partida .rcg | ${COPY.brand}`,
    description: COPY.description,
    canonical: APP_PATH,
    noindex: true,
    lang: 'pt-BR',
    alternates: false,
    social: true,
    copy: COPY,
    jsonLd: [],
  },
  '404': {
    title: `Página não encontrada | ${COPY.brand}`,
    description: 'A página que você pediu não existe.',
    canonical: null,
    noindex: true,
    lang: 'pt-BR',
    alternates: false,
    social: false,
    copy: COPY,
    jsonLd: [],
  },
}

/** The `hreflang` links: each language, and `x-default` on the Portuguese home. */
function alternateTags(): string[] {
  const links = Object.values(COPY_BY_LOCALE).map(
    (copy) => [copy.lang, `${SITE}${copy.path}`] as const,
  )
  return [...links, ['x-default', `${SITE}/`] as const].map(
    ([lang, href]) => `<link rel="alternate" hreflang="${lang}" href="${href}" />`,
  )
}

/** The other languages' `og:locale:alternate` values, for a page that has language versions. */
function otherLocales(page: PageHead): [string, string][] {
  if (!page.alternates) return []
  return Object.values(COPY_BY_LOCALE)
    .filter((other) => other.lang !== page.copy.lang)
    .map((other) => ['og:locale:alternate', other.ogLocale])
}

function socialTags(page: PageHead): string[] {
  const { copy } = page
  const og: [string, string][] = [
    ['og:type', 'website'],
    ['og:site_name', copy.brand],
    ['og:locale', copy.ogLocale],
    ...otherLocales(page),
    ['og:title', page.title],
    ['og:description', page.description],
    ['og:url', `${SITE}${page.canonical ?? '/'}`],
    ['og:image', OG_IMAGE],
    ['og:image:width', '1200'],
    ['og:image:height', '630'],
    ['og:image:alt', copy.ogAlt],
  ]
  const twitter: [string, string][] = [
    ['twitter:card', 'summary_large_image'],
    ['twitter:title', page.title],
    ['twitter:description', page.description],
    ['twitter:image', OG_IMAGE],
    ['twitter:image:alt', copy.ogAlt],
  ]
  return [
    ...og.map(
      ([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}" />`,
    ),
    ...twitter.map(([name, content]) => `<meta name="${name}" content="${escapeHtml(content)}" />`),
  ]
}

/** The `<title>` and `<meta>`, `<link>` and JSON-LD tags that replace the shell's `<title>`. */
export function headTags(page: PageHead): string {
  const tags = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
  ]
  if (page.noindex) tags.push('<meta name="robots" content="noindex" />')
  if (page.canonical !== null) tags.push(`<link rel="canonical" href="${SITE}${page.canonical}" />`)
  if (page.alternates) tags.push(...alternateTags())
  if (page.social) tags.push(...socialTags(page))
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

function cell(copy: Copy, value: ComparisonRow['viewer']): string {
  return `<td class="py-2.5 pr-3 pl-3 align-top"><span class="sr-only">${escapeHtml(copy.comparison.support[value.support])}. </span>${escapeHtml(value.text)}</td>`
}

function comparisonTable(copy: Copy): string {
  const { comparison } = copy
  const rows = comparison.rows
    .map(
      (row) =>
        `<tr class="border-b border-border last:border-b-0"><th class="px-3 py-2.5 align-top font-medium" scope="row">${escapeHtml(row.feature)}${'live' in row ? ' *' : ''}</th>${cell(copy, row.viewer)}${cell(copy, row.monitor)}</tr>`,
    )
    .join('')
  return `<div class="flex flex-col gap-3"><div class="overflow-x-auto rounded-[18px] bg-card shadow-island">
<table class="w-full border-collapse text-left text-[13px]"><caption class="sr-only">${escapeHtml(comparison.caption)}</caption>
<thead><tr class="border-b border-border text-[12px] text-muted-foreground"><th class="w-[34%] px-3 py-2.5 font-medium" scope="col">${escapeHtml(comparison.feature)}</th><th class="px-3 py-2.5 font-medium text-foreground" scope="col">${escapeHtml(comparison.viewer)}</th><th class="px-3 py-2.5 font-medium" scope="col">${escapeHtml(comparison.monitor)}</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<p class="text-[13px] text-muted-foreground">* ${escapeHtml(comparison.liveNote)}</p></div>`
}

function factsList(copy: Copy): string {
  const items = copy.safety.facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join('')
  return `<ul class="grid max-w-[720px] gap-x-8 gap-y-2 text-[15px] leading-6 md:grid-cols-2 list-disc pl-5">${items}</ul>`
}

/**
 * The landing page's text and links as plain HTML, styled by the bundle's CSS. The figures that
 * need the clip and a canvas are left to the client, which is why they have no markup here.
 */
export function landingHtml(clipUrl: string, copy: Copy = COPY): string {
  const clipHref = `${SITE}${addressOf(APP_PATH, { url: `${SITE}${clipUrl}`, live: null }, GOAL_CYCLE)}`
  const { hero, nav, footer } = copy
  const { language } = nav
  return `<div class="min-h-svh bg-background">
<header class="${PAGE} flex h-16 items-center justify-between">
<span class="text-[15px] font-semibold tracking-[-0.01em]">${escapeHtml(copy.brand)}</span>
<nav aria-label="${escapeHtml(nav.label)}" class="flex items-center gap-1"><a class="${buttonVariants({ variant: 'ghost', className: 'h-9 rounded-[10px] px-3 text-[13px]' })}" href="${language.path}" hreflang="${language.lang}" lang="${language.lang}">${escapeHtml(language.text)}</a><a class="${buttonVariants({ variant: 'ghost', className: 'h-9 rounded-[10px] px-3 text-[13px]' })}" href="${APP_PATH}">${escapeHtml(copy.nav.app)}</a></nav>
</header>
<main>
<section aria-labelledby="hero-title" class="${PAGE} flex flex-col items-start gap-5 pt-6 pb-16 md:pt-12 md:pb-24">
<h1 class="text-[34px] leading-[1.08] font-semibold tracking-[-0.025em] text-balance md:text-[46px]" id="hero-title">${escapeHtml(hero.title)}</h1>
<p class="${LEAD} max-w-[44ch] md:text-[16px] md:leading-7">${escapeHtml(hero.lead)}</p>
<a class="${buttonVariants({ variant: 'secondary', className: 'h-11 rounded-[12px] px-4 text-[14px]' })}" href="${escapeHtml(clipHref)}">${escapeHtml(hero.openClip)}</a>
</section>
${section('lances', copy.moments.title, copy.moments.body)}
${section('camadas', copy.layers.title, copy.layers.body)}
${section('numeros', copy.stats.title, copy.stats.body)}
${section('link', copy.link.title, copy.link.body)}
${section('teclado', copy.keys.title, copy.keys.body)}
${section('ao-vivo', copy.live.title, copy.live.body)}
${section('seguranca', copy.safety.title, copy.safety.body, factsList(copy))}
${section('comparacao', copy.comparison.title, copy.comparison.body, comparisonTable(copy))}
<section aria-labelledby="fim" class="${PAGE} flex flex-col items-start gap-4 border-t border-border py-16 md:py-24">
<h2 class="text-[28px] leading-9 font-semibold tracking-[-0.015em]" id="fim">${escapeHtml(copy.closing.title)}</h2>
<a class="${buttonVariants({ variant: 'ghost', className: 'h-11 rounded-[12px] px-4 text-[14px]' })}" href="${APP_PATH}">${escapeHtml(copy.nav.app)}</a>
</section>
</main>
<footer class="${PAGE} border-t border-border py-8 text-[12px] text-muted-foreground">
<p>${escapeHtml(footer.text)}</p>${footer.appNote === '' ? '' : `\n<p class="mt-1">${escapeHtml(footer.appNote)}</p>`}
<p class="mt-1"><a class="underline underline-offset-2" href="${copy.footer.tapoutHref}">${escapeHtml(copy.footer.tapout)}</a></p>
</footer>
</div>`
}

/** Writes the head of `page` into the shell, and `body` into its empty root when given. */
export function renderPage(shell: string, page: PageHead, body: string | null): string {
  if (!shell.includes(SHELL_TITLE)) throw new Error(`prerender: shell has no ${SHELL_TITLE}`)
  if (!shell.includes(ROOT)) throw new Error(`prerender: shell has no ${ROOT}`)
  const withHead = shell
    .replace(SHELL_TITLE, () => headTags(page))
    .replace(SHELL_LANG, `<html lang="${page.lang}">`)
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
    ['en.html', renderPage(shell, PAGES.en, landingHtml(clip, COPY_BY_LOCALE.en))],
    ['app.html', renderPage(shell, PAGES.app, null)],
    ['404.html', renderPage(shell, PAGES['404'], null)],
  ]
  for (const [name, html] of outputs) writeFileSync(path.join(dist, name), html)
}

if (import.meta.main) main()
