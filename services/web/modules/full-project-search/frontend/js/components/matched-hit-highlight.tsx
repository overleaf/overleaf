import React, { FC, useMemo } from 'react'
import { Hit } from '../util/search-snapshot'
import { getMatchedHitSnippet } from '../util/matched-hit-snippet'

export const MatchedHitHighlight: FC<{ text: string; hit: Hit }> = ({
  text,
  hit,
}) => {
  const parts = useMemo(() => {
    return getMatchedHitSnippet(text, hit.matchIndex, hit.length)
  }, [hit, text])

  return (
    <span className="matched-hit-snippet">
      {parts.before}
      <b className="matched-hit-highlight">{parts.match}</b>
      {parts.after}
    </span>
  )
}
