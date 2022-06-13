import { Dropdown, MenuItem } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import ControlledDropdown from '../../../shared/components/controlled-dropdown'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import classnames from 'classnames'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import PdfCompileButtonInner from './pdf-compile-button-inner'
import getMeta from '../../../utils/meta'

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
  const showStopOnFirstError = getMeta('ol-showStopOnFirstError')

  return (
    <ControlledDropdown
      className={classnames({
        'toolbar-item': true,
        'btn-recompile-group': true,
        'btn-recompile-group-has-changes': hasChanges,
      })}
      id="pdf-recompile-dropdown"
    >
      <PdfCompileButtonInner
        startCompile={startCompile}
        compiling={compiling}
      />

      <Dropdown.Toggle
        aria-label={t('toggle_compile_options_menu')}
        className={classnames({
          'btn-recompile': true,
          'btn-recompile-animate': animateCompileDropdownArrow,
        })}
        bsStyle="success"
        onAnimationEnd={() => {
          setAnimateCompileDropdownArrow(false)
        }}
      />

      <Dropdown.Menu>
        <MenuItem header>{t('auto_compile')}</MenuItem>

        <MenuItem onSelect={() => setAutoCompile(true)}>
          <Icon type={autoCompile ? 'check' : ''} fw />
          {t('on')}
        </MenuItem>

        <MenuItem onSelect={() => setAutoCompile(false)}>
          <Icon type={!autoCompile ? 'check' : ''} fw />
          {t('off')}
        </MenuItem>

        <MenuItem header>{t('compile_mode')}</MenuItem>

        <MenuItem onSelect={() => setDraft(false)}>
          <Icon type={!draft ? 'check' : ''} fw />
          {t('normal')}
        </MenuItem>

        <MenuItem onSelect={() => setDraft(true)}>
          <Icon type={draft ? 'check' : ''} fw />
          {t('fast')} <span className="subdued">[draft]</span>
        </MenuItem>

        <MenuItem header>Syntax Checks</MenuItem>

        <MenuItem onSelect={() => setStopOnValidationError(true)}>
          <Icon type={stopOnValidationError ? 'check' : ''} fw />
          {t('stop_on_validation_error')}
        </MenuItem>

        <MenuItem onSelect={() => setStopOnValidationError(false)}>
          <Icon type={!stopOnValidationError ? 'check' : ''} fw />
          {t('ignore_validation_errors')}
        </MenuItem>

        {showStopOnFirstError && (
          <MenuItem header>{t('compile_error_handling')}</MenuItem>
        )}

        {showStopOnFirstError && (
          <MenuItem onSelect={enableStopOnFirstError}>
            <Icon type={stopOnFirstError ? 'check' : ''} fw />
            {t('stop_on_first_error')}
          </MenuItem>
        )}

        {showStopOnFirstError && (
          <MenuItem onSelect={disableStopOnFirstError}>
            <Icon type={!stopOnFirstError ? 'check' : ''} fw />
            {t('try_to_compile_despite_errors')}
          </MenuItem>
        )}

        <MenuItem divider />

        <MenuItem
          onSelect={() => stopCompile()}
          disabled={!compiling}
          aria-disabled={!compiling}
        >
          {t('stop_compile')}
        </MenuItem>

        <MenuItem
          onSelect={() => recompileFromScratch()}
          disabled={compiling}
          aria-disabled={compiling}
        >
          {t('recompile_from_scratch')}
        </MenuItem>
      </Dropdown.Menu>
    </ControlledDropdown>
  )
}

export default memo(PdfCompileButton)
