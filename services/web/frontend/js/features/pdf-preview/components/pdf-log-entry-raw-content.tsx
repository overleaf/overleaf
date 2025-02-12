import { useCallback, useState } from 'react'
import { useResizeObserver } from '../../../shared/hooks/use-resize-observer'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import OLButton from '@/features/ui/components/ol/ol-button'
import Icon from '../../../shared/components/icon'

export default function PdfLogEntryRawContent({
  rawContent,
  collapsedSize = 0,
}: {
  rawContent: string
  collapsedSize?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [needsExpander, setNeedsExpander] = useState(true)

  const { elementRef } = useResizeObserver(
    useCallback(
      element => {
        if (element.scrollHeight === 0) return // skip update when logs-pane is closed
        setNeedsExpander(element.scrollHeight > collapsedSize)
      },
      [collapsedSize]
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
        <pre className="log-entry-content-raw" ref={elementRef}>
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
            bs3Props={{
              bsSize: 'xsmall',
              className: 'log-entry-btn-expand-collapse',
            }}
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
