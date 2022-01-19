import PropTypes from 'prop-types'
import { Dropdown, MenuItem, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import Icon from '../../../shared/components/icon'
import ControlledDropdown from '../../../shared/components/controlled-dropdown'

function PreviewRecompileButton({
  compilerState: {
    autoCompileHasChanges,
    autoCompileHasLintingError,
    isAutoCompileOn,
    isCompiling,
    isDraftModeOn,
    isSyntaxCheckOn,
  },
  onRecompile,
  onRecompileFromScratch,
  onRunSyntaxCheckNow,
  onStopCompilation,
  onSetAutoCompile,
  onSetDraftMode,
  onSetSyntaxCheck,
  showText,
}) {
  const { t } = useTranslation()

  function handleSelectAutoCompileOn() {
    onSetAutoCompile(true)
  }

  function handleSelectAutoCompileOff() {
    onSetAutoCompile(false)
  }

  function handleSelectDraftModeOn() {
    onSetDraftMode(true)
  }

  function handleSelectDraftModeOff() {
    onSetDraftMode(false)
  }

  function handleSelectSyntaxCheckOn() {
    onSetSyntaxCheck(true)
  }

  function handleSelectSyntaxCheckOff() {
    onSetSyntaxCheck(false)
  }

  let compilingProps = {}
  let recompileProps = {}
  function _hideText(keepAria) {
    return {
      'aria-hidden': !keepAria,
      style: {
        position: 'absolute',
        right: '-100vw',
      },
    }
  }

  if (!showText) {
    compilingProps = _hideText(isCompiling)
    recompileProps = _hideText(!isCompiling)
  } else if (isCompiling) {
    recompileProps = _hideText()
  } else {
    compilingProps = _hideText()
  }

  const recompileButtonGroupClasses = classNames(
    'btn-recompile-group',
    'toolbar-item',
    {
      'btn-recompile-group-has-changes':
        autoCompileHasChanges && !autoCompileHasLintingError,
    }
  )

  const buttonElement = (
    <ControlledDropdown
      id="pdf-recompile-dropdown"
      className={recompileButtonGroupClasses}
    >
      <button className="btn btn-recompile" onClick={() => onRecompile()}>
        <Icon type="refresh" spin={isCompiling} />

        <span id="text-compiling" className="toolbar-text" {...compilingProps}>
          {t('compiling')}
          &hellip;
        </span>

        <span id="text-recompile" className="toolbar-text" {...recompileProps}>
          {t('recompile')}
        </span>
      </button>
      <Dropdown.Toggle
        aria-label={t('toggle_compile_options_menu')}
        className="btn btn-recompile"
        bsStyle="success"
      />
      <Dropdown.Menu>
        <MenuItem header>{t('auto_compile')}</MenuItem>
        <MenuItem onSelect={handleSelectAutoCompileOn}>
          <Icon type={isAutoCompileOn ? 'check' : ''} fw />
          {t('on')}
        </MenuItem>
        <MenuItem onSelect={handleSelectAutoCompileOff}>
          <Icon type={!isAutoCompileOn ? 'check' : ''} fw />
          {t('off')}
        </MenuItem>
        <MenuItem header>{t('compile_mode')}</MenuItem>
        <MenuItem onSelect={handleSelectDraftModeOff}>
          <Icon type={!isDraftModeOn ? 'check' : ''} fw />
          {t('normal')}
        </MenuItem>
        <MenuItem onSelect={handleSelectDraftModeOn}>
          <Icon type={isDraftModeOn ? 'check' : ''} fw />
          {t('fast')} <span className="subdued">[draft]</span>
        </MenuItem>
        <MenuItem header>Syntax Checks</MenuItem>
        <MenuItem onSelect={handleSelectSyntaxCheckOn}>
          <Icon type={isSyntaxCheckOn ? 'check' : ''} fw />
          {t('stop_on_validation_error')}
        </MenuItem>
        <MenuItem onSelect={handleSelectSyntaxCheckOff}>
          <Icon type={!isSyntaxCheckOn ? 'check' : ''} fw />
          {t('ignore_validation_errors')}
        </MenuItem>
        <MenuItem onSelect={onRunSyntaxCheckNow}>
          <Icon type="" fw />
          {t('run_syntax_check_now')}
        </MenuItem>
        <MenuItem className={!isCompiling ? 'hidden' : ''} divider />
        <MenuItem
          onSelect={onStopCompilation}
          className={!isCompiling ? 'hidden' : ''}
          disabled={!isCompiling}
          aria-disabled={!isCompiling}
        >
          {t('stop_compile')}
        </MenuItem>
        <MenuItem divider />
        <MenuItem
          onSelect={onRecompileFromScratch}
          disabled={isCompiling}
          aria-disabled={!!isCompiling}
        >
          {t('recompile_from_scratch')}
        </MenuItem>
      </Dropdown.Menu>
    </ControlledDropdown>
  )

  return showText ? (
    buttonElement
  ) : (
    <OverlayTrigger
      placement="bottom"
      overlay={
        <Tooltip id="tooltip-download-pdf">
          {isCompiling ? t('compiling') : t('recompile')}
        </Tooltip>
      }
    >
      {buttonElement}
    </OverlayTrigger>
  )
}

PreviewRecompileButton.propTypes = {
  compilerState: PropTypes.shape({
    autoCompileHasChanges: PropTypes.bool.isRequired,
    autoCompileHasLintingError: PropTypes.bool,
    isAutoCompileOn: PropTypes.bool.isRequired,
    isCompiling: PropTypes.bool.isRequired,
    isDraftModeOn: PropTypes.bool.isRequired,
    isSyntaxCheckOn: PropTypes.bool.isRequired,
    logEntries: PropTypes.object.isRequired,
  }),
  onRecompile: PropTypes.func.isRequired,
  onRecompileFromScratch: PropTypes.func.isRequired,
  onRunSyntaxCheckNow: PropTypes.func.isRequired,
  onSetAutoCompile: PropTypes.func.isRequired,
  onSetDraftMode: PropTypes.func.isRequired,
  onSetSyntaxCheck: PropTypes.func.isRequired,
  onStopCompilation: PropTypes.func.isRequired,
  showText: PropTypes.bool.isRequired,
}

export default PreviewRecompileButton
