export function shouldIncludeElement({
  hide,
}: {
  hide?: boolean | (() => boolean)
}): boolean {
  if (typeof hide === 'function') {
    return !hide()
  }
  return !hide
}
