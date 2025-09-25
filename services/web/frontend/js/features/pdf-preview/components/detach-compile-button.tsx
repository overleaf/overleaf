import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import classnames from 'classnames'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLButton from '@/shared/components/ol/ol-button'

const modifierKey = /Mac/i.test(navigator.platform) ? 'Cmd' : 'Ctrl'

function DetachCompileButton() {
  const { t } = useTranslation()
  const { compiling, startCompile, hasChanges } = useDetachCompileContext()

  const tooltipElement = (
    <>
      {t('recompile_pdf')}{' '}
      <span className="keyboard-shortcut">({modifierKey} + Enter)</span>
    </>
  )

  return (
    <div className="detach-compile-button-container ms-1">
      <OLTooltip
        id="detach-compile"
        description={tooltipElement}
        tooltipProps={{ className: 'keyboard-tooltip' }}
        overlayProps={{ delay: { show: 500, hide: 0 } }}
      >
        <OLButton
          variant="primary"
          onClick={() => startCompile()}
          disabled={compiling}
          className={classnames('detach-compile-button', {
            'btn-striped-animated': hasChanges,
            'detach-compile-button-disabled': compiling,
          })}
          size="sm"
          isLoading={compiling}
          loadingLabel={t('compiling')}
        >
          {t('recompile')}
        </OLButton>
      </OLTooltip>
    </div>
  )
}

export default memo(DetachCompileButton)
