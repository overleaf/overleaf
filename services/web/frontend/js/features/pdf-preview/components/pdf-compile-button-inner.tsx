import { Button } from 'react-bootstrap'
import Tooltip from '../../../shared/components/tooltip'
import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'

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

  const compileButtonLabel = compiling ? `${t('compiling')}…` : t('recompile')

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
        onClick={() => startCompile()}
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
