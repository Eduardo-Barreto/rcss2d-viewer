import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { APP_PATH } from '@/player/app-route'
import { useReplay } from '@/player/store'

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false
}

/** Opening a log from the landing page: the file starts reading here and the app shows it. */
export interface OpenLog {
  /** Opens the first file of a picker or drop. */
  openFiles: (files: FileList | null | undefined) => void
  /** True while a file is dragged over the window. */
  dragging: boolean
}

/** Picks or drops a log anywhere on the page and moves to the app while it is read. */
export function useOpenLog(): OpenLog {
  const navigate = useNavigate()
  const [dragging, setDragging] = useState(false)

  const openFiles = useCallback(
    (files: FileList | null | undefined) => {
      const file = files?.[0]
      if (file === undefined) return
      void useReplay.getState().open({ kind: 'file', file, name: file.name })
      void navigate({ to: APP_PATH })
    },
    [navigate],
  )

  useEffect(() => {
    let depth = 0
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth++
      setDragging(true)
    }
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault()
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      openFiles(event.dataTransfer?.files)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [openFiles])

  return { openFiles, dragging }
}
