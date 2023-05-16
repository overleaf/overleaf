import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import classNames from 'classnames'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import SplitMenu from '../../../shared/components/split-menu'
import Icon from '../../../shared/components/icon'

const modifierKey = /Mac/i.test(navigator.platform) ? 'Cmd' : 'Ctrl'

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

  const compileButtonLabel = compiling ? `${t('compiling')}…` : t('recompile')
  const tooltipElement = (
    <>
      {t('recompile_pdf')}{' '}
      <span className="keyboard-shortcut">({modifierKey} + Enter)</span>
    </>
  )

  const dropdownToggleClassName = classNames({
    'detach-compile-button-animate': animateCompileDropdownArrow,
    'btn-striped-animated': hasChanges,
  })

  const buttonClassName = classNames({
    'btn-striped-animated': hasChanges,
    'no-left-radius': true,
  })

  return (
    <SplitMenu
      bsStyle="primary"
      bsSize="xs"
      disabled={compiling}
      button={{
        tooltip: {
          description: tooltipElement,
          id: 'compile',
          tooltipProps: { className: 'keyboard-tooltip' },
          overlayProps: { delayShow: 500 },
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

      <SplitMenu.Item onSelect={() => setAutoCompile(true)}>
        <Icon type={autoCompile ? 'check' : ''} fw />
        {t('on')}
      </SplitMenu.Item>

      <SplitMenu.Item onSelect={() => setAutoCompile(false)}>
        <Icon type={!autoCompile ? 'check' : ''} fw />
        {t('off')}
      </SplitMenu.Item>

      <SplitMenu.Item header>{t('compile_mode')}</SplitMenu.Item>

      <SplitMenu.Item onSelect={() => setDraft(false)}>
        <Icon type={!draft ? 'check' : ''} fw />
        {t('normal')}
      </SplitMenu.Item>

      <SplitMenu.Item onSelect={() => setDraft(true)}>
        <Icon type={draft ? 'check' : ''} fw />
        {t('fast')} <span className="subdued">[draft]</span>
      </SplitMenu.Item>

      <SplitMenu.Item header>Syntax Checks</SplitMenu.Item>

      <SplitMenu.Item onSelect={() => setStopOnValidationError(true)}>
        <Icon type={stopOnValidationError ? 'check' : ''} fw />
        {t('stop_on_validation_error')}
      </SplitMenu.Item>

      <SplitMenu.Item onSelect={() => setStopOnValidationError(false)}>
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
        onSelect={() => recompileFromScratch()}
        disabled={compiling}
        aria-disabled={compiling}
      >
        {t('recompile_from_scratch')}
      </SplitMenu.Item>
    </SplitMenu>
  )
}

export default memo(PdfCompileButton)
