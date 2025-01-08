import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import classNames from 'classnames'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import SplitMenu from '../../../shared/components/split-menu'
import Icon from '../../../shared/components/icon'
import * as eventTracking from '../../../infrastructure/event-tracking'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import {
  DropdownToggleCustom,
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/features/ui/components/bootstrap-5/dropdown-menu'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLButtonGroup from '@/features/ui/components/ol/ol-button-group'
import { bsVersion, isBootstrap5 } from '@/features/utils/bootstrap-5'
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
    setAnimateCompileDropdownArrow,
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

  const compileButtonLabel = compiling ? `${t('compiling')}…` : t('recompile')
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
    bsVersion({ bs5: 'dropdown-button-toggle' })
  )

  const buttonClassName = classNames(
    {
      'btn-striped-animated': hasChanges,
      'align-items-center py-0': isBootstrap5(),
    },
    'no-left-radius px-3'
  )

  return (
    <BootstrapVersionSwitcher
      bs3={
        <SplitMenu
          bsStyle="primary"
          bsSize="xs"
          disabled={compiling}
          button={{
            tooltip: {
              description: tooltipElement,
              id: 'compile',
              tooltipProps: { className: 'keyboard-tooltip' },
              overlayProps: {
                delayShow: 500,
                placement: detachRole === 'detached' ? 'bottom' : undefined,
              },
            },
            icon: { type: 'refresh', spin: compiling },
            onClick: () => startCompile(),
            text: compileButtonLabel,
            className: buttonClassName,
          }}
          dropdownToggle={{
            'aria-label': t('toggle_compile_options_menu'),
            handleAnimationEnd: () => setAnimateCompileDropdownArrow(false),
            className: dropdownToggleClassName,
          }}
          dropdown={{
            id: 'pdf-recompile-dropdown',
          }}
        >
          <SplitMenu.Item header>{t('auto_compile')}</SplitMenu.Item>

          <SplitMenu.Item
            onSelect={() =>
              sendEventAndSet(true, setAutoCompile, 'auto-compile')
            }
          >
            <Icon type={autoCompile ? 'check' : ''} fw />
            {t('on')}
          </SplitMenu.Item>

          <SplitMenu.Item
            onSelect={() =>
              sendEventAndSet(false, setAutoCompile, 'auto-compile')
            }
          >
            <Icon type={!autoCompile ? 'check' : ''} fw />
            {t('off')}
          </SplitMenu.Item>

          <SplitMenu.Item header>{t('compile_mode')}</SplitMenu.Item>

          <SplitMenu.Item
            onSelect={() => sendEventAndSet(false, setDraft, 'compile-mode')}
          >
            <Icon type={!draft ? 'check' : ''} fw />
            {t('normal')}
          </SplitMenu.Item>

          <SplitMenu.Item
            onSelect={() => sendEventAndSet(true, setDraft, 'compile-mode')}
          >
            <Icon type={draft ? 'check' : ''} fw />
            {t('fast')} <span className="subdued">[draft]</span>
          </SplitMenu.Item>

          <SplitMenu.Item header>Syntax Checks</SplitMenu.Item>

          <SplitMenu.Item
            onSelect={() =>
              sendEventAndSet(true, setStopOnValidationError, 'syntax-check')
            }
          >
            <Icon type={stopOnValidationError ? 'check' : ''} fw />
            {t('stop_on_validation_error')}
          </SplitMenu.Item>

          <SplitMenu.Item
            onSelect={() =>
              sendEventAndSet(false, setStopOnValidationError, 'syntax-check')
            }
          >
            <Icon type={!stopOnValidationError ? 'check' : ''} fw />
            {t('ignore_validation_errors')}
          </SplitMenu.Item>

          <SplitMenu.Item header>{t('compile_error_handling')}</SplitMenu.Item>

          <SplitMenu.Item onSelect={enableStopOnFirstError}>
            <Icon type={stopOnFirstError ? 'check' : ''} fw />
            {t('stop_on_first_error')}
          </SplitMenu.Item>

          <SplitMenu.Item onSelect={disableStopOnFirstError}>
            <Icon type={!stopOnFirstError ? 'check' : ''} fw />
            {t('try_to_compile_despite_errors')}
          </SplitMenu.Item>

          <SplitMenu.Item divider />

          <SplitMenu.Item
            onSelect={() => stopCompile()}
            disabled={!compiling}
            aria-disabled={!compiling}
          >
            {t('stop_compile')}
          </SplitMenu.Item>

          <SplitMenu.Item
            onSelect={fromScratchWithEvent}
            disabled={compiling}
            aria-disabled={compiling}
          >
            {t('recompile_from_scratch')}
          </SplitMenu.Item>
        </SplitMenu>
      }
      bs5={
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
            <DropdownHeader>Syntax Checks</DropdownHeader>
            <li role="none">
              <DropdownItem
                as="button"
                onClick={() =>
                  sendEventAndSet(
                    true,
                    setStopOnValidationError,
                    'syntax-check'
                  )
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
                  sendEventAndSet(
                    false,
                    setStopOnValidationError,
                    'syntax-check'
                  )
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
      }
    />
  )
}

export default memo(PdfCompileButton)
