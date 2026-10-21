import { createFileRoute } from '@tanstack/react-router'

import { ReplayView } from '@/components/replay/replay-view'

export const Route = createFileRoute('/app')({ component: ReplayView })
