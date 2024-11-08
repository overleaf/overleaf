import { FC, useCallback, useRef, useState } from 'react'
import OLButton from '@/features/ui/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'

export const ExpandableContent: FC<{
  className?: string
  content: string
  contentLimit?: number
  newLineCharsLimit?: number
  checkNewLines?: boolean
  inline?: boolean
}> = ({
  content,
  className,
  contentLimit = 50,
  newLineCharsLimit = 3,
  checkNewLines = true,
  inline = false,
}) => {
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
      >
        {isExpanded ? content : content.slice(0, limit)}
        {isOverflowing && !isExpanded && '...'}
      </div>
      <div
        className={classNames('review-panel-expandable-links', {
          'review-panel-expandable-inline': inline,
        })}
      >
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
      </div>
    </>
  )
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
