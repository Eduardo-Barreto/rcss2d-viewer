import { createFileRoute, redirect } from '@tanstack/react-router'

import { Landing } from '@/components/landing/landing'
import { APP_PATH, forwardsToApp } from '@/player/app-route'

export const Route = createFileRoute('/')({
  beforeLoad: ({ location }) => {
    if (forwardsToApp(location.searchStr, location.hash)) {
      throw redirect({ to: APP_PATH, search: location.search, hash: location.hash, replace: true })
    }
  },
  component: Landing,
})
