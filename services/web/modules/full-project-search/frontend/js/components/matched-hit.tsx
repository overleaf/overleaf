import { FC, useCallback, useLayoutEffect, useRef } from 'react'
import { Hit, MatchedFile } from '../util/search-snapshot'
import { MatchedHitHighlight } from './matched-hit-highlight'
import classnames from 'classnames'

export const MatchedHit: FC<{
  matchedFile: MatchedFile
  hit: Hit
  selected?: boolean
  setSelectedHit(hit?: Hit): void
  tabIndex: 0 | -1
}> = ({ matchedFile, hit, selected = false, setSelectedHit, tabIndex }) => {
  const containerRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (selected) {
      containerRef.current?.focus()
    }
  }, [selected])

  const handleSelect: React.MouseEventHandler = useCallback(
    event => {
      event.preventDefault()
      setSelectedHit(hit)
    },
    [hit, setSelectedHit]
  )

  return (
    <button
      className={classnames('list-group-item matched-file-hit', {
        'matched-file-hit-selected': selected,
      })}
      ref={containerRef}
      tabIndex={tabIndex}
      onMouseDown={handleSelect}
      aria-selected={selected}
      role="option"
    >
      <span className="matched-line-number">{hit.lineIndex + 1}</span>

      <MatchedHitHighlight text={matchedFile.lines[hit.lineIndex]} hit={hit} />
    </button>
  )
}
