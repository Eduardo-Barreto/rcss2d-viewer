import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { lazy } from 'react'

import { SettingsMenu } from '@/components/settings-menu'

const RouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(async () => {
      const devtools = await import('@tanstack/react-router-devtools')
      return { default: devtools.TanStackRouterDevtools }
    })

export const Route = createRootRoute({
  component: RootLayout,
})

const navLinks = [{ to: '/', label: 'Início' }] as const

function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
          <span className="font-semibold">rcss2d-viewer</span>
          <nav className="flex items-center gap-4 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground [&.active]:font-medium"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <SettingsMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <RouterDevtools position="bottom-right" />
    </div>
  )
}
