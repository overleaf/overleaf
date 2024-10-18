import { FC, useCallback, useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import OLButton from '@/features/ui/components/ol/ol-button'
import { useTranslation } from 'react-i18next'

export const ExpandableContent: FC<{ className?: string }> = ({
  children,
  className,
}) => {
  const { t } = useTranslation()
  const contentRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    if (contentRef.current) {
      setIsOverflowing(
        contentRef.current.scrollHeight > contentRef.current.clientHeight
      )
    }
  }, [])

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
    <div>
      <div
        ref={contentRef}
        className={classNames(
          'review-panel-content-expandable',
          {
            'review-panel-content-expanded': isExpanded,
          },
          className
        )}
      >
        {children}
      </div>
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
  )
}
