import React, { FC, useMemo } from 'react'
import { Hit } from '../util/search-snapshot'

export const MatchedHitHighlight: FC<{ text: string; hit: Hit }> = ({
  text,
  hit,
}) => {
  const parts = useMemo(() => {
    let before = text.substring(0, hit.matchIndex).trimStart()
    const match = text.substring(hit.matchIndex, hit.matchIndex + hit.length)
    let after = text.substring(hit.matchIndex + hit.length).trimEnd()

    // reduce the prefix to a sensible size before trimming
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

    // reduce the suffix to a sensible size before trimming
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
  }, [hit, text])

  return (
    <span className="matched-hit-snippet">
      {parts.before}
      <b className="matched-hit-highlight">{parts.match}</b>
      {parts.after}
    </span>
  )
}
