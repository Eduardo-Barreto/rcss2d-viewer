const REVOKE_AFTER_MS = 1000

/** Hands a blob to the browser as a download named `name`. */
export function download(blob: Blob, name: string): void {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), REVOKE_AFTER_MS)
}
