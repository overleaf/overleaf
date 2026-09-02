import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import classNames from 'classnames'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import * as eventTracking from '../../../infrastructure/event-tracking'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import {
  OLDropdownToggleCustom,
  OLDropdown,
  OLDropdownDivider,
  OLDropdownHeader,
  OLDropdownItem,
  OLDropdownMenu,
  OLDropdownToggle,
} from '@/shared/components/ol/ol-dropdown-menu'
import OLButton from '@/shared/components/ol/ol-button'
import OLButtonGroup from '@/shared/components/ol/ol-button-group'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useCommandProvider } from '@/features/ide-react/hooks/use-command-provider'

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
    isNetworkStalled,
  } = useCompileContext()
  const { enableStopOnFirstError, disableStopOnFirstError } =
    useStopOnFirstError({ eventSource: 'dropdown' })

  const { t } = useTranslation()

  // The two compile modes (Normal / Fast [draft]) are mutually exclusive.
  const setCompileMode = useCallback(
    (mode: 'normal' | 'draft') => {
      eventTracking.sendMB('recompile-setting-changed', {
        setting: 'compile-mode',
        settingVal: mode,
      })
      setDraft(mode === 'draft')
    },
    [setDraft]
  )

  const { detachRole } = useLayoutContext()

  const fromScratchWithEvent = useCallback(() => {
    eventTracking.sendMB('recompile-setting-changed', {
      setting: 'from-scratch',
    })
    recompileFromScratch()
  }, [recompileFromScratch])

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
      'compile-button-network-stalled': isNetworkStalled,
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
      'compile-button-network-stalled': isNetworkStalled,
    }
  )

  useCommandProvider(
    () => [
      {
        id: 'compile',
        handler: () => startCompile(),
        label: t('recompile'),
        disabled: compiling || isNetworkStalled,
      },
      {
        id: 'stop-compile',
        handler: () => stopCompile(),
        label: t('stop_compile'),
        disabled: !compiling,
      },
      {
        id: 'recompile-from-scratch',
        handler: fromScratchWithEvent,
        label: t('recompile_from_scratch'),
        disabled: compiling || isNetworkStalled,
      },
    ],
    [
      startCompile,
      t,
      compiling,
      stopCompile,
      fromScratchWithEvent,
      isNetworkStalled,
    ]
  )

  return (
    <OLDropdown as={OLButtonGroup} className="compile-button-group">
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
          disabled={compiling || isNetworkStalled}
          isLoading={compiling}
          onClick={() => startCompile()}
          className={buttonClassName}
          loadingLabel={`${t('compiling')}…`}
        >
          {t('recompile')}
        </OLButton>
      </OLTooltip>

      <OLDropdownToggle
        as={OLDropdownToggleCustom}
        split
        variant="primary"
        id="pdf-recompile-dropdown"
        size="sm"
        aria-label={t('toggle_compile_options_menu')}
        disabled={isNetworkStalled}
        className={dropdownToggleClassName}
      />

      <OLDropdownMenu>
        <OLDropdownHeader>{t('auto_compile')}</OLDropdownHeader>
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={() =>
              sendEventAndSet(true, setAutoCompile, 'auto-compile')
            }
            trailingIcon={autoCompile ? 'check' : null}
          >
            {t('on')}
          </OLDropdownItem>
        </li>
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={() =>
              sendEventAndSet(false, setAutoCompile, 'auto-compile')
            }
            trailingIcon={!autoCompile ? 'check' : null}
          >
            {t('off')}
          </OLDropdownItem>
        </li>
        <OLDropdownDivider />
        <OLDropdownHeader>{t('compile_mode')}</OLDropdownHeader>
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={() => setCompileMode('normal')}
            trailingIcon={!draft ? 'check' : null}
          >
            {t('normal')}
          </OLDropdownItem>
        </li>
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={() => setCompileMode('draft')}
            trailingIcon={draft ? 'check' : null}
          >
            {t('fast')}&nbsp;<span className="subdued">[draft]</span>
          </OLDropdownItem>
        </li>
        <OLDropdownDivider />
        <OLDropdownHeader>{t('syntax_checks')}</OLDropdownHeader>
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={() =>
              sendEventAndSet(true, setStopOnValidationError, 'syntax-check')
            }
            trailingIcon={stopOnValidationError ? 'check' : null}
          >
            {t('stop_on_validation_error')}
          </OLDropdownItem>
        </li>
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={() =>
              sendEventAndSet(false, setStopOnValidationError, 'syntax-check')
            }
            trailingIcon={!stopOnValidationError ? 'check' : null}
          >
            {t('ignore_validation_errors')}
          </OLDropdownItem>
        </li>
        <OLDropdownDivider />
        <OLDropdownHeader>{t('compile_error_handling')}</OLDropdownHeader>
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={enableStopOnFirstError}
            trailingIcon={stopOnFirstError ? 'check' : null}
          >
            {t('stop_on_first_error')}
          </OLDropdownItem>
        </li>
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={disableStopOnFirstError}
            trailingIcon={!stopOnFirstError ? 'check' : null}
          >
            {t('try_to_compile_despite_errors')}
          </OLDropdownItem>
        </li>
        <OLDropdownDivider />
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={() => stopCompile()}
            disabled={!compiling}
            aria-disabled={!compiling}
          >
            {t('stop_compile')}
          </OLDropdownItem>
        </li>
        <li role="none">
          <OLDropdownItem
            as="button"
            onClick={fromScratchWithEvent}
            disabled={compiling || isNetworkStalled}
            aria-disabled={compiling || isNetworkStalled}
          >
            {t('recompile_from_scratch')}
          </OLDropdownItem>
        </li>
      </OLDropdownMenu>
    </OLDropdown>
  )
}

export default memo(PdfCompileButton)
