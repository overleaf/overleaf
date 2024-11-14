import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import classnames from 'classnames'
import Icon from '../../../shared/components/icon'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLButton from '@/features/ui/components/ol/ol-button'
import { bsVersion } from '@/features/utils/bootstrap-5'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

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
    <div
      className={classnames(
        'detach-compile-button-container',
        bsVersion({ bs5: 'ms-1' })
      )}
    >
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
          bs3Props={{
            loading: compiling && (
              <>
                <Icon type="refresh" spin={compiling} />
                <span className="detach-compile-button-label">
                  {compileButtonLabel}
                </span>
              </>
            ),
          }}
        >
          <BootstrapVersionSwitcher
            bs3={
              <>
                <Icon type="refresh" spin={compiling} />
                <span className="detach-compile-button-label">
                  {compileButtonLabel}
                </span>
              </>
            }
            bs5={t('recompile')}
          />
        </OLButton>
      </OLTooltip>
    </div>
  )
}

export default memo(DetachCompileButton)
