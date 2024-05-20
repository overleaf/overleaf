const ALLOWED_PROTOCOLS = ['https:', 'http:']

export const openURL = (content: string) => {
  const url = new URL(content, document.location.href)

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    throw new Error(`Not opening URL with protocol ${url.protocol}`)
  }

  window.open(url, '_blank')
}
