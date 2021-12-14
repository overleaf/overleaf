export function buildUrlWithDetachRole(mode) {
  const url = new URL(window.location)
  let cleanPathname = url.pathname
    .replace(/\/(detached|detacher)\/?$/, '')
    .replace(/\/$/, '')
  if (mode) {
    cleanPathname += `/${mode}`
  }
  url.pathname = cleanPathname
  return url
}
