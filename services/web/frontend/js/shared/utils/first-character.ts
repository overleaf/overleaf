export default function firstCharacter(str: string): string {
  if (!str) {
    return ''
  }

  if (Intl?.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter(undefined, {
        granularity: 'grapheme',
      })
      // eslint-disable-next-line no-unreachable-loop
      for (const { segment } of segmenter.segment(str)) {
        return segment
      }
    } catch {
      // Fall back to the code point approach below.
    }
  }

  // NOTE: .charAt(0), [0], and .substring(0, 1) will all split multi-byte
  // characters (e.g. emojis) into multiple characters, but the spread operator
  // will keep them mostly intact. This still isn't perfect, so the grapheme
  // segmenter above is preferred when available.
  const [first] = [...str]
  return first ?? ''
}
