export function buildUrlWithDetachRole(mode) {
  const url = new URL(window.location)
  const cleanPathname = url.pathname
    .replace(/\/(detached|detacher)\/?$/, '')
    .replace(/\/$/, '')
  url.pathname = cleanPathname
  if (mode) {
    url.pathname += `/${mode}`
  }
  return url
}
