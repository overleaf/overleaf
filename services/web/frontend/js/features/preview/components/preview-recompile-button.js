import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { Dropdown, MenuItem } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

function PreviewRecompileButton({
  compilerState: {
    isAutoCompileOn,
    isCompiling,
    isDraftModeOn,
    isSyntaxCheckOn
  },
  onRecompile,
  onRunSyntaxCheckNow,
  onSetAutoCompile,
  onSetDraftMode,
  onSetSyntaxCheck
}) {
  const { t } = useTranslation()

  const iconClasses = {
    recompile: classNames('fa', 'fa-refresh', {
      'fa-spin': isCompiling
    }),
    autoCompileOn: classNames('fa', 'fa-fw', { 'fa-check': isAutoCompileOn }),
    autoCompileOff: classNames('fa', 'fa-fw', { 'fa-check': !isAutoCompileOn }),
    compileModeNormal: classNames('fa', 'fa-fw', {
      'fa-check': !isDraftModeOn
    }),
    compileModeDraft: classNames('fa', 'fa-fw', { 'fa-check': isDraftModeOn }),
    syntaxCheckOn: classNames('fa', 'fa-fw', { 'fa-check': isSyntaxCheckOn }),
    syntaxCheckOff: classNames('fa', 'fa-fw', { 'fa-check': !isSyntaxCheckOn })
  }

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

  return (
    <Dropdown id="pdf-recompile-dropdown" className="btn-recompile-group">
      <button className="btn btn-recompile" onClick={onRecompile}>
        <i className={iconClasses.recompile} aria-hidden="true" />
        {isCompiling ? (
          <span className="btn-recompile-label">
            {t('compiling')}
            &hellip;
          </span>
        ) : (
          <span className="btn-recompile-label">{t('recompile')}</span>
        )}
      </button>
      <Dropdown.Toggle className="btn btn-recompile" />
      <Dropdown.Menu>
        <MenuItem header>{t('auto_compile')}</MenuItem>
        <MenuItem onSelect={handleSelectAutoCompileOn}>
          <i className={iconClasses.autoCompileOn} aria-hidden="true" />
          {t('on')}
        </MenuItem>
        <MenuItem onSelect={handleSelectAutoCompileOff}>
          <i className={iconClasses.autoCompileOff} aria-hidden="true" />
          {t('off')}
        </MenuItem>
        <MenuItem header>{t('compile_mode')}</MenuItem>
        <MenuItem onSelect={handleSelectDraftModeOff}>
          <i className={iconClasses.compileModeNormal} aria-hidden="true" />
          {t('normal')}
        </MenuItem>
        <MenuItem onSelect={handleSelectDraftModeOn}>
          <i className={iconClasses.compileModeDraft} aria-hidden="true" />
          {t('fast')} <span className="subdued">[draft]</span>
        </MenuItem>
        <MenuItem header>Syntax Checks</MenuItem>
        <MenuItem onSelect={handleSelectSyntaxCheckOn}>
          <i className={iconClasses.syntaxCheckOn} aria-hidden="true" />
          {t('stop_on_validation_error')}
        </MenuItem>
        <MenuItem onSelect={handleSelectSyntaxCheckOff}>
          <i className={iconClasses.syntaxCheckOff} aria-hidden="true" />
          {t('ignore_validation_errors')}
        </MenuItem>
        <MenuItem onSelect={onRunSyntaxCheckNow}>
          <i className="fa fa-fw" aria-hidden="true" />
          {t('run_syntax_check_now')}
        </MenuItem>
      </Dropdown.Menu>
    </Dropdown>
  )
}

PreviewRecompileButton.propTypes = {
  compilerState: PropTypes.shape({
    isAutoCompileOn: PropTypes.bool.isRequired,
    isCompiling: PropTypes.bool.isRequired,
    isDraftModeOn: PropTypes.bool.isRequired,
    isSyntaxCheckOn: PropTypes.bool.isRequired
  }),
  onRecompile: PropTypes.func.isRequired,
  onRunSyntaxCheckNow: PropTypes.func.isRequired,
  onSetAutoCompile: PropTypes.func.isRequired,
  onSetDraftMode: PropTypes.func.isRequired,
  onSetSyntaxCheck: PropTypes.func.isRequired
}

export default PreviewRecompileButton
