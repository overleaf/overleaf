import { useCallback, useState } from 'react'
import { useResizeObserver } from '../../../shared/hooks/use-resize-observer'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import OLButton from '@/features/ui/components/ol/ol-button'
import Icon from '../../../shared/components/icon'

export default function PdfLogEntryRawContent({
  rawContent,
  collapsedSize = 0,
  alwaysExpanded = false,
}: {
  rawContent: string
  collapsedSize?: number
  alwaysExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(alwaysExpanded)
  const [needsExpander, setNeedsExpander] = useState(!alwaysExpanded)

  const { elementRef } = useResizeObserver(
    useCallback(
      (element: Element) => {
        if (element.scrollHeight === 0) return // skip update when logs-pane is closed
        setNeedsExpander(
          !alwaysExpanded && element.scrollHeight > collapsedSize
        )
      },
      [collapsedSize, alwaysExpanded]
    )
  )

  const { t } = useTranslation()

  return (
    <div className="log-entry-content-raw-container">
      <div
        className="expand-collapse-container"
        style={{
          height: expanded || !needsExpander ? 'auto' : collapsedSize,
        }}
      >
        <pre className="log-entry-content-raw" ref={elementRef} translate="no">
          {rawContent.trim()}
        </pre>
      </div>

      {needsExpander && (
        <div
          className={classNames('log-entry-content-button-container', {
            'log-entry-content-button-container-collapsed': !expanded,
          })}
        >
          <OLButton
            variant="secondary"
            size="sm"
            onClick={() => setExpanded(value => !value)}
          >
            {expanded ? (
              <>
                <Icon type="angle-up" /> {t('collapse')}
              </>
            ) : (
              <>
                <Icon type="angle-down" /> {t('expand')}
              </>
            )}
          </OLButton>
        </div>
      )}
    </div>
  )
}
