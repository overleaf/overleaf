import { Button } from 'react-bootstrap'
import PropTypes from 'prop-types'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import { useSplitTestContext } from '../../../shared/context/split-test-context'
import * as eventTracking from '../../../infrastructure/event-tracking'

const modifierKey = /Mac/i.test(navigator.platform) ? 'Cmd' : 'Ctrl'

type PdfCompileButtonInnerProps = {
  startCompile: () => void
  compiling: boolean
}

function PdfCompileButtonInner({
  startCompile,
  compiling,
}: PdfCompileButtonInnerProps) {
  const { t } = useTranslation()

  const { splitTestVariants } = useSplitTestContext({
    splitTestVariants: PropTypes.object,
  })
  const recompileButtonTextVariant = splitTestVariants['recompile-button-text']

  let compileButtonLabel
  if (compiling) {
    compileButtonLabel = t('compiling') + '…'
  } else if (splitTestVariants['recompile-button-text'] === 'recompile-pdf') {
    compileButtonLabel = t('recompile') + ' PDF'
  } else {
    compileButtonLabel = t('recompile')
  }

  const handleRecompileButtonClick = useCallback(() => {
    if (recompileButtonTextVariant != null) {
      // Only send the event when the user is targeted by the
      // recompile-button-text split test
      eventTracking.sendMB('recompile-pdf-clicked')
    }
    startCompile()
  }, [recompileButtonTextVariant, startCompile])

  return (
    <Tooltip
      id="logs-toggle"
      description={
        <>
          {t('recompile_pdf')}{' '}
          <span className="keyboard-shortcut">({modifierKey} + Enter)</span>
        </>
      }
      tooltipProps={{ className: 'keyboard-tooltip' }}
      overlayProps={{ delayShow: 500 }}
    >
      <Button
        className="btn-recompile"
        bsStyle="primary"
        onClick={handleRecompileButtonClick}
        aria-label={compileButtonLabel}
        disabled={compiling}
        data-ol-loading={compiling}
      >
        <Icon type="refresh" spin={compiling} />
        <span className="toolbar-hide-medium toolbar-hide-small btn-recompile-label">
          {compileButtonLabel}
        </span>
      </Button>
    </Tooltip>
  )
}

export default memo(PdfCompileButtonInner)
