export function buildUrlWithDetachRole(mode: string | null) {
  return cleanURL(new URL(window.location.href), mode)
}

export function cleanURL(url: URL, mode: string | null) {
  let cleanPathname = url.pathname
    .replace(/\/(detached|detacher)\/?$/, '')
    .replace(/\/$/, '')
  if (mode) {
    cleanPathname += `/${mode}`
  }
  url.pathname = cleanPathname
  return url
}
