import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import PreviewLogsPaneEntry from './preview-logs-pane-entry'

function PreviewError({ name }) {
  const { t } = useTranslation()
  let errorTitle
  let errorContent

  if (name === 'error') {
    errorTitle = t('server_error')
    errorContent = <>{t('somthing_went_wrong_compiling')}</>
  } else if (name === 'renderingError') {
    errorTitle = t('pdf_rendering_error')
    errorContent = <>{t('something_went_wrong_rendering_pdf')}</>
  } else if (name === 'clsiMaintenance') {
    errorTitle = t('server_error')
    errorContent = <>{t('clsi_maintenance')}</>
  } else if (name === 'clsiUnavailable') {
    errorTitle = t('server_error')
    errorContent = <>{t('clsi_unavailable')}</>
  } else if (name === 'tooRecentlyCompiled') {
    errorTitle = t('server_error')
    errorContent = <>{t('too_recently_compiled')}</>
  } else if (name === 'compileTerminated') {
    errorTitle = t('terminated')
    errorContent = <>{t('compile_terminated_by_user')}</>
  } else if (name === 'rateLimited') {
    errorTitle = t('pdf_compile_rate_limit_hit')
    errorContent = <>{t('project_flagged_too_many_compiles')}</>
  } else if (name === 'compileInProgress') {
    errorTitle = t('pdf_compile_in_progress_error')
    errorContent = <>{t('pdf_compile_try_again')}</>
  } else if (name === 'timedout') {
    errorTitle = t('timedout')
    errorContent = (
      <>
        {t('proj_timed_out_reason')}
        <div>
          <a
            href="https://www.overleaf.com/learn/how-to/Why_do_I_keep_getting_the_compile_timeout_error_message%3F"
            target="_blank"
          >
            {t('learn_how_to_make_documents_compile_quickly')}
          </a>
        </div>
      </>
    )
  } else if (name === 'autoCompileDisabled') {
    errorTitle = t('autocompile_disabled')
    errorContent = <>{t('autocompile_disabled_reason')}</>
  }

  return errorTitle ? (
    <PreviewLogsPaneEntry
      headerTitle={errorTitle}
      formattedContent={errorContent}
      entryAriaLabel={t('compile_error_entry_description')}
      level="error"
    />
  ) : null
}

PreviewError.propTypes = {
  name: PropTypes.string.isRequired
}

export default PreviewError
