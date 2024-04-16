import { useCallback, useState } from 'react'
import { useResizeObserver } from '../../../shared/hooks/use-resize-observer'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { Button } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import PropTypes from 'prop-types'

export default function PdfLogEntryRawContent({
  rawContent,
  collapsedSize = 0,
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
          <Button
            bsSize="xs"
            bsStyle={null}
            className="log-entry-btn-expand-collapse btn-secondary"
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
          </Button>
        </div>
      )}
    </div>
  )
}

PdfLogEntryRawContent.propTypes = {
  rawContent: PropTypes.string.isRequired,
  collapsedSize: PropTypes.number,
}
