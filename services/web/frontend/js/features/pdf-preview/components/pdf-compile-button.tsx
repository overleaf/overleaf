import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import classNames from 'classnames'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import * as eventTracking from '../../../infrastructure/event-tracking'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import {
  DropdownToggleCustom,
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import OLButton from '@/shared/components/ol/ol-button'
import OLButtonGroup from '@/shared/components/ol/ol-button-group'
import { useLayoutContext } from '@/shared/context/layout-context'

const modifierKey = /Mac/i.test(navigator.platform) ? 'Cmd' : 'Ctrl'

function sendEventAndSet<T extends boolean>(
  value: T,
  setter: (value: T) => void,
  settingName: string
) {
  eventTracking.sendMB('recompile-setting-changed', {
    setting: settingName,
    settingVal: value,
  })
  setter(value)
}

function PdfCompileButton() {
  const {
    animateCompileDropdownArrow,
    autoCompile,
    compiling,
    draft,
    hasChanges,
    setAutoCompile,
    setDraft,
    setStopOnValidationError,
    stopOnFirstError,
    stopOnValidationError,
    startCompile,
    stopCompile,
    recompileFromScratch,
  } = useCompileContext()
  const { enableStopOnFirstError, disableStopOnFirstError } =
    useStopOnFirstError({ eventSource: 'dropdown' })

  const { t } = useTranslation()

  const { detachRole } = useLayoutContext()

  const fromScratchWithEvent = () => {
    eventTracking.sendMB('recompile-setting-changed', {
      setting: 'from-scratch',
    })
    recompileFromScratch()
  }

  const tooltipElement = (
    <>
      {t('recompile_pdf')}{' '}
      <span className="keyboard-shortcut">({modifierKey} + Enter)</span>
    </>
  )

  const dropdownToggleClassName = classNames(
    {
      'detach-compile-button-animate': animateCompileDropdownArrow,
      'btn-striped-animated': hasChanges,
    },
    'no-left-border',
    'dropdown-button-toggle',
    'compile-dropdown-toggle'
  )

  const buttonClassName = classNames(
    'align-items-center py-0 no-left-radius px-3',
    'compile-button',
    {
      'btn-striped-animated': hasChanges,
    }
  )

  return (
    <Dropdown as={OLButtonGroup} className="compile-button-group">
      <OLTooltip
        description={tooltipElement}
        id="compile"
        tooltipProps={{ className: 'keyboard-tooltip' }}
        overlayProps={{
          delay: { show: 500, hide: 0 },
          placement: detachRole === 'detached' ? 'bottom' : undefined,
        }}
      >
        <OLButton
          variant="primary"
          disabled={compiling}
          isLoading={compiling}
          onClick={() => startCompile()}
          className={buttonClassName}
          loadingLabel={`${t('compiling')}…`}
        >
          {t('recompile')}
        </OLButton>
      </OLTooltip>

      <DropdownToggle
        as={DropdownToggleCustom}
        split
        variant="primary"
        id="pdf-recompile-dropdown"
        size="sm"
        aria-label={t('toggle_compile_options_menu')}
        className={dropdownToggleClassName}
      />

      <DropdownMenu>
        <DropdownHeader>{t('auto_compile')}</DropdownHeader>
        <li role="none">
          <DropdownItem
            as="button"
            onClick={() =>
              sendEventAndSet(true, setAutoCompile, 'auto-compile')
            }
            trailingIcon={autoCompile ? 'check' : null}
          >
            {t('on')}
          </DropdownItem>
        </li>
        <li role="none">
          <DropdownItem
            as="button"
            onClick={() =>
              sendEventAndSet(false, setAutoCompile, 'auto-compile')
            }
            trailingIcon={!autoCompile ? 'check' : null}
          >
            {t('off')}
          </DropdownItem>
        </li>
        <DropdownDivider />
        <DropdownHeader>{t('compile_mode')}</DropdownHeader>
        <li role="none">
          <DropdownItem
            as="button"
            onClick={() => sendEventAndSet(false, setDraft, 'compile-mode')}
            trailingIcon={!draft ? 'check' : null}
          >
            {t('normal')}
          </DropdownItem>
        </li>
        <li role="none">
          <DropdownItem
            as="button"
            onClick={() => sendEventAndSet(true, setDraft, 'compile-mode')}
            trailingIcon={draft ? 'check' : null}
          >
            {t('fast')}&nbsp;<span className="subdued">[draft]</span>
          </DropdownItem>
        </li>
        <DropdownDivider />
        <DropdownHeader>{t('syntax_checks')}</DropdownHeader>
        <li role="none">
          <DropdownItem
            as="button"
            onClick={() =>
              sendEventAndSet(true, setStopOnValidationError, 'syntax-check')
            }
            trailingIcon={stopOnValidationError ? 'check' : null}
          >
            {t('stop_on_validation_error')}
          </DropdownItem>
        </li>
        <li role="none">
          <DropdownItem
            as="button"
            onClick={() =>
              sendEventAndSet(false, setStopOnValidationError, 'syntax-check')
            }
            trailingIcon={!stopOnValidationError ? 'check' : null}
          >
            {t('ignore_validation_errors')}
          </DropdownItem>
        </li>
        <DropdownDivider />
        <DropdownHeader>{t('compile_error_handling')}</DropdownHeader>
        <li role="none">
          <DropdownItem
            as="button"
            onClick={enableStopOnFirstError}
            trailingIcon={stopOnFirstError ? 'check' : null}
          >
            {t('stop_on_first_error')}
          </DropdownItem>
        </li>
        <li role="none">
          <DropdownItem
            as="button"
            onClick={disableStopOnFirstError}
            trailingIcon={!stopOnFirstError ? 'check' : null}
          >
            {t('try_to_compile_despite_errors')}
          </DropdownItem>
        </li>
        <DropdownDivider />
        <li role="none">
          <DropdownItem
            as="button"
            onClick={() => stopCompile()}
            disabled={!compiling}
            aria-disabled={!compiling}
          >
            {t('stop_compile')}
          </DropdownItem>
        </li>
        <li role="none">
          <DropdownItem
            as="button"
            onClick={fromScratchWithEvent}
            disabled={compiling}
            aria-disabled={compiling}
          >
            {t('recompile_from_scratch')}
          </DropdownItem>
        </li>
      </DropdownMenu>
    </Dropdown>
  )
}

export default memo(PdfCompileButton)
