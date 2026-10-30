import { Outlet, createRootRoute } from '@tanstack/react-router'

import { useBooted } from '@/lib/booted'

function Root() {
  useBooted()
  return <Outlet />
}

export const Route = createRootRoute({
  component: Root,
})
