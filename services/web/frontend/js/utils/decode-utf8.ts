// TODO: MIGRATION: Can we use TextDecoder now? https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder
// See http://ecmanaut.blogspot.co.uk/2006/07/encoding-decoding-utf8-in-javascript.html
export function decodeUtf8(text: string) {
  return decodeURIComponent(escape(text))
}
