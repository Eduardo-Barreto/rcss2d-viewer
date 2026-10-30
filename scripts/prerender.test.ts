import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { COPY } from '@/components/landing/copy'
import { COPY_EN } from '@/components/landing/copy-en'

import {
  PAGES,
  SITE,
  clipAssetUrl,
  escapeHtml,
  headTags,
  jsonLdScript,
  landingHtml,
  renderPage,
} from './prerender'

const SHELL = `<!doctype html><html lang="pt-BR"><head><title>rcssviewer</title><script type="module" src="/assets/a.js"></script></head><body><div id="root"></div></body></html>`
const CLIP = '/assets/robocup2026-final.rcg-abc123.gz'

const index = renderPage(SHELL, PAGES.index, landingHtml(CLIP))
const en = renderPage(SHELL, PAGES.en, landingHtml(CLIP, COPY_EN))
const app = renderPage(SHELL, PAGES.app, null)
const notFound = renderPage(SHELL, PAGES['404'], null)
const pages = { index, en, app, notFound }

function count(html: string, pattern: RegExp): number {
  return html.match(pattern)?.length ?? 0
}

describe('prerendered routes', () => {
  test('each route has its own title', () => {
    const titles = Object.values(pages).map((html) => /<title>(.*?)<\/title>/.exec(html)?.[1])
    expect(new Set(titles).size).toBe(4)
    expect(titles[0]).toContain('.rcg')
    expect(titles[0]).toContain('RoboCup Soccer Simulation 2D')
  })

  test('the home has one canonical and is indexable', () => {
    expect(count(index, /rel="canonical"/g)).toBe(1)
    expect(index).toContain(`<link rel="canonical" href="${SITE}/" />`)
    expect(index).not.toContain('noindex')
  })

  test('the English page is its own indexable file in English', () => {
    expect(en).toContain('<html lang="en">')
    expect(index).toContain('<html lang="pt-BR">')
    expect(en).toContain(`<title>${COPY_EN.title}</title>`)
    expect(count(en, /rel="canonical"/g)).toBe(1)
    expect(en).toContain(`<link rel="canonical" href="${SITE}/en" />`)
    expect(en).toContain(`<meta property="og:url" content="${SITE}/en" />`)
    expect(en).toContain('<meta property="og:locale" content="en_US" />')
    expect(en).toContain('<meta property="og:locale:alternate" content="pt_BR" />')
    expect(en).not.toContain('noindex')
    expect(en).toContain(`<h1`)
    expect(en).toContain(COPY_EN.hero.title)
    expect(en).not.toContain(COPY.hero.title)
    expect(en).toContain('<div id="root"><div')
  })

  test('both languages list the same hreflang set, themselves included', () => {
    const set = [
      `<link rel="alternate" hreflang="pt-BR" href="${SITE}/" />`,
      `<link rel="alternate" hreflang="en" href="${SITE}/en" />`,
      `<link rel="alternate" hreflang="x-default" href="${SITE}/" />`,
    ]
    for (const html of [index, en]) {
      for (const link of set) expect(html).toContain(link)
      expect(count(html, /hreflang=/g)).toBe(3 + 1)
    }
    for (const html of [app, notFound]) expect(html).not.toContain('rel="alternate"')
  })

  test('each landing links to the other as a real anchor', () => {
    expect(index).toMatch(/<a [^>]*href="\/en" hreflang="en" lang="en">English<\/a>/)
    expect(en).toMatch(/<a [^>]*href="\/" hreflang="pt-BR" lang="pt-BR">Português<\/a>/)
  })

  test('only the Portuguese home carries the WebSite JSON-LD', () => {
    expect(en).not.toContain('ld+json')
  })

  test('the app canonicals to /app and is noindex', () => {
    expect(app).toContain(`<link rel="canonical" href="${SITE}/app" />`)
    expect(app).toContain('<meta name="robots" content="noindex" />')
  })

  test('the 404 is noindex and has no canonical', () => {
    expect(notFound).toContain('<meta name="robots" content="noindex" />')
    expect(notFound).not.toContain('rel="canonical"')
  })

  test('the og image is absolute and the Twitter card is large', () => {
    expect(index).toContain(`<meta property="og:image" content="${SITE}/og.png" />`)
    expect(index).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(index).toContain(`<meta property="og:url" content="${SITE}/" />`)
  })

  test('the WebSite JSON-LD is only on the home and agrees with the brand', () => {
    expect(count(index, /application\/ld\+json/g)).toBe(1)
    expect(app).not.toContain('ld+json')
    expect(notFound).not.toContain('ld+json')
    const json = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(index)?.[1] ?? ''
    expect(JSON.parse(json)).toMatchObject({
      '@type': 'WebSite',
      name: 'rcssviewer',
      url: `${SITE}/`,
    })
    expect(index).toContain('<meta property="og:site_name" content="rcssviewer" />')
  })

  test('the home carries the real landing text and real links', () => {
    expect(index).toContain('<h1')
    expect(index).toContain(COPY.hero.title)
    expect(index).toContain('v4 a v6, com ou sem gzip')
    expect(index).toContain('mapa de calor')
    expect(index).toContain('<a ')
    expect(index).toContain('href="/app"')
    expect(index).toContain('href="https://tapout.gg"')
    expect(index).toContain(encodeURIComponent(`${SITE}${CLIP}`))
    expect(index).toContain('<div id="root"><div')
  })

  test('the app and the 404 keep an empty root for the client', () => {
    expect(app).toContain('<div id="root"></div>')
    expect(notFound).toContain('<div id="root"></div>')
  })

  test('no route gets meta keywords', () => {
    for (const html of Object.values(pages)) expect(html).not.toContain('name="keywords"')
  })
})

describe('helpers', () => {
  test('escapeHtml neutralizes markup and quotes', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
  })

  test('jsonLdScript cannot be closed from inside a value', () => {
    expect(jsonLdScript({ name: '</script><b>' })).not.toContain('</script><b>')
  })

  test('headTags escapes a description with quotes', () => {
    const tags = headTags({ ...PAGES.index, description: 'diz "oi"' })
    expect(tags).toContain('content="diz &quot;oi&quot;"')
  })

  test('renderPage refuses a shell it cannot fill', () => {
    expect(() => renderPage('<html></html>', PAGES.index, null)).toThrow('<title>')
  })

  test('clipAssetUrl finds the hashed clip and fails without it', () => {
    expect(clipAssetUrl(['a.js', 'robocup2026-final.rcg-U9gLWdzz.gz'])).toBe(
      '/assets/robocup2026-final.rcg-U9gLWdzz.gz',
    )
    expect(() => clipAssetUrl(['a.js'])).toThrow('clip')
  })
})

describe('static files', () => {
  const robots = readFileSync('public/robots.txt', 'utf8')
  const sitemap = readFileSync('public/sitemap.xml', 'utf8')

  test('robots.txt allows crawling, so noindex can be read, and points at the sitemap', () => {
    expect(robots).not.toMatch(/^Disallow:\s*\S/m)
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`)
  })

  test('the sitemap lists both languages of the home, with no invented dates', () => {
    expect(sitemap.match(/<loc>(.*?)<\/loc>/g)).toEqual([
      `<loc>${SITE}/</loc>`,
      `<loc>${SITE}/en</loc>`,
    ])
    expect(sitemap).not.toMatch(/lastmod|priority|changefreq/)
  })
})
