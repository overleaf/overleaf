export const getMatchedHitSnippet = (
  text: string,
  matchIndex: number,
  length: number
) => {
  let before = text.substring(0, matchIndex).trimStart()
  const match = text.substring(matchIndex, matchIndex + length)
  let after = text.substring(matchIndex + length).trimEnd()

  if (before.length > 250) {
    before = before.substring(before.length - 250)
  }

  while (before.length > 10) {
    const replacement = before.replace(/^\S+\s+/, '')
    if (before.length === replacement.length) {
      break
    }
    before = replacement
  }

  if (after.length > 250) {
    after = after.substring(0, 250)
  }

  while (after.length > 100) {
    const replacement = after.replace(/\s+\S+$/, '')
    if (after.length === replacement.length) {
      break
    }
    after = replacement
  }

  return { before, match, after }
}
