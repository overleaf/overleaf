import {
  Button,
  Dropdown,
  MenuItem,
  OverlayTrigger,
  Tooltip,
} from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import ControlledDropdown from '../../../shared/components/controlled-dropdown'
import { useTranslation } from 'react-i18next'
import { memo } from 'react'
import classnames from 'classnames'
import { useCompileContext } from '../../../shared/context/compile-context'

const modifierKey = /Mac/i.test(navigator.platform) ? 'Cmd' : 'Ctrl'

function PdfCompileButton() {
  const {
    autoCompile,
    compiling,
    draft,
    hasChanges,
    setAutoCompile,
    setDraft,
    setStopOnValidationError,
    stopOnValidationError,
    startCompile,
    stopCompile,
    recompileFromScratch,
  } = useCompileContext()

  const { t } = useTranslation()

  const compileButtonLabel = compiling ? t('compiling') + '…' : t('recompile')

  return (
    <ControlledDropdown
      className={classnames({
        'toolbar-item': true,
        'btn-recompile-group': true,
        'btn-recompile-group-has-changes': hasChanges,
      })}
      id="pdf-recompile-dropdown"
    >
      <OverlayTrigger
        placement="bottom"
        delayShow={500}
        overlay={
          <Tooltip id="tooltip-logs-toggle" className="keyboard-tooltip">
            {t('recompile_pdf')}{' '}
            <span className="keyboard-shortcut">({modifierKey} + Enter)</span>
          </Tooltip>
        }
      >
        <Button
          className="btn-recompile"
          bsStyle="success"
          onClick={startCompile}
          aria-label={compileButtonLabel}
        >
          <Icon type="refresh" spin={compiling} />
          <span className="toolbar-hide-medium toolbar-hide-small btn-recompile-label">
            {compileButtonLabel}
          </span>
        </Button>
      </OverlayTrigger>

      <Dropdown.Toggle
        aria-label={t('toggle_compile_options_menu')}
        className="btn-recompile"
        bsStyle="success"
      />

      <Dropdown.Menu>
        <MenuItem header>{t('auto_compile')}</MenuItem>

        <MenuItem onSelect={() => setAutoCompile(true)}>
          <Icon type={autoCompile ? 'check' : ''} modifier="fw" />
          {t('on')}
        </MenuItem>

        <MenuItem onSelect={() => setAutoCompile(false)}>
          <Icon type={!autoCompile ? 'check' : ''} modifier="fw" />
          {t('off')}
        </MenuItem>

        <MenuItem header>{t('compile_mode')}</MenuItem>

        <MenuItem onSelect={() => setDraft(false)}>
          <Icon type={!draft ? 'check' : ''} modifier="fw" />
          {t('normal')}
        </MenuItem>

        <MenuItem onSelect={() => setDraft(true)}>
          <Icon type={draft ? 'check' : ''} modifier="fw" />
          {t('fast')} <span className="subdued">[draft]</span>
        </MenuItem>

        <MenuItem header>Syntax Checks</MenuItem>

        <MenuItem onSelect={() => setStopOnValidationError(true)}>
          <Icon type={stopOnValidationError ? 'check' : ''} modifier="fw" />
          {t('stop_on_validation_error')}
        </MenuItem>

        <MenuItem onSelect={() => setStopOnValidationError(false)}>
          <Icon type={!stopOnValidationError ? 'check' : ''} modifier="fw" />
          {t('ignore_validation_errors')}
        </MenuItem>

        <MenuItem divider />

        <MenuItem
          onSelect={stopCompile}
          disabled={!compiling}
          aria-disabled={!compiling}
        >
          {t('stop_compile')}
        </MenuItem>

        <MenuItem
          onSelect={recompileFromScratch}
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
