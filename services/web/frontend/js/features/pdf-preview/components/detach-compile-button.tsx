import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import { Button } from 'react-bootstrap'
import classNames from 'classnames'
import Icon from '../../../shared/components/icon'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import Tooltip from '../../../shared/components/tooltip'

const modifierKey = /Mac/i.test(navigator.platform) ? 'Cmd' : 'Ctrl'

function DetachCompileButton() {
  const { t } = useTranslation()
  const { compiling, startCompile, hasChanges } = useDetachCompileContext()

  const compileButtonLabel = compiling ? `${t('compiling')}…` : t('recompile')
  const tooltipElement = (
    <>
      {t('recompile_pdf')}{' '}
      <span className="keyboard-shortcut">({modifierKey} + Enter)</span>
    </>
  )

  return (
    <div className="detach-compile-button-container">
      <Tooltip
        id="detach-compile"
        description={tooltipElement}
        tooltipProps={{ className: 'keyboard-tooltip' }}
        overlayProps={{ delayShow: 500 }}
      >
        <Button
          bsStyle="primary"
          onClick={() => startCompile()}
          disabled={compiling}
          className={classNames('detach-compile-button', {
            'btn-striped-animated': hasChanges,
            'detach-compile-button-disabled': compiling,
          })}
        >
          <Icon type="refresh" spin={compiling} />
          <span className="detach-compile-button-label">
            {compileButtonLabel}
          </span>
        </Button>
      </Tooltip>
    </div>
  )
}

export default memo(DetachCompileButton)
