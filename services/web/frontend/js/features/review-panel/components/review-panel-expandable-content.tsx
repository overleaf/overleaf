import { memo, useCallback, useMemo, useRef, useState } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { PreventSelectingEntry } from './review-panel-prevent-selecting'
import { MentionBadge } from './mention-badge'
import {
  MentionSegment,
  parseMentions,
  sliceMentionSegments,
} from '../utils/parse-mentions'

export const ExpandableContent = memo<{
  className?: string
  content: string
  contentLimit?: number
  newLineCharsLimit?: number
  checkNewLines?: boolean
  inline?: boolean
  translate?: 'yes' | 'no'
  displayMentions?: boolean
}>(function ExpandableContent({
  content,
  className,
  contentLimit = 50,
  newLineCharsLimit = 3,
  checkNewLines = true,
  inline = false,
  translate,
  displayMentions = false,
}) {
  const { t } = useTranslation()
  const contentRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const limit = checkNewLines
    ? Math.min(
        contentLimit,
        indexOfNthLine(content, newLineCharsLimit) ?? Infinity
      )
    : contentLimit

  const isOverflowing = content.length > limit

  const segments = useMemo(
    () => (displayMentions ? parseMentions(content) : null),
    [content, displayMentions]
  )

  const renderedContent = segments
    ? renderSegments(
        isExpanded ? segments : sliceMentionSegments(segments, limit)
      )
    : isExpanded
      ? content
      : content.slice(0, limit)

  const handleShowMore = useCallback(() => {
    setIsExpanded(true)
    contentRef.current?.dispatchEvent(
      new CustomEvent('review-panel:position', { bubbles: true })
    )
  }, [])

  const handleShowLess = useCallback(() => {
    setIsExpanded(false)
    contentRef.current?.dispatchEvent(
      new CustomEvent('review-panel:position', { bubbles: true })
    )
  }, [])

  return (
    <>
      <div
        ref={contentRef}
        className={classNames('review-panel-expandable-content', className)}
        translate={translate}
      >
        {renderedContent}
        {isOverflowing && !isExpanded && '...'}
      </div>
      <div
        className={classNames('review-panel-expandable-links', {
          'review-panel-expandable-inline': inline,
        })}
      >
        <PreventSelectingEntry>
          {isExpanded ? (
            <OLButton
              variant="link"
              className="btn-inline-link"
              onClick={handleShowLess}
            >
              {t('show_less')}
            </OLButton>
          ) : (
            isOverflowing && (
              <OLButton
                variant="link"
                className="btn-inline-link"
                onClick={handleShowMore}
              >
                {t('show_more')}
              </OLButton>
            )
          )}
        </PreventSelectingEntry>
      </div>
    </>
  )
})

function renderSegments(segments: MentionSegment[]) {
  return segments.map((segment, i) => {
    if (segment.type === 'mention') {
      return (
        <MentionBadge key={`${i}-${segment.userId}`} userId={segment.userId} />
      )
    }
    return segment.value
  })
}

function indexOfNthLine(content: string, n: number) {
  if (n < 1) return null

  let line = 0
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      line++
      if (line === n) {
        return i
      }
    }
  }
  return null
}
