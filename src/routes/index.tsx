import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return <h1 className="text-2xl font-semibold tracking-tight">rcss2d-viewer</h1>
}
