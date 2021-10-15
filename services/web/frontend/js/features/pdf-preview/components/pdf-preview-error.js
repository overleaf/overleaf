import PropTypes from 'prop-types'
import { useTranslation, Trans } from 'react-i18next'
import { memo } from 'react'
import PdfLogEntry from './pdf-log-entry'

function PdfPreviewError({ error }) {
  const { t } = useTranslation()

  switch (error) {
    case 'rendering-error':
      return (
        <ErrorLogEntry title={t('pdf_rendering_error')}>
          {t('something_went_wrong_rendering_pdf')}
        </ErrorLogEntry>
      )

    case 'clsi-maintenance':
      return (
        <ErrorLogEntry title={t('server_error')}>
          {t('clsi_maintenance')}
        </ErrorLogEntry>
      )

    case 'clsi-unavailable':
      return (
        <ErrorLogEntry title={t('server_error')}>
          {t('clsi_unavailable')}
        </ErrorLogEntry>
      )

    case 'too-recently-compiled':
      return (
        <ErrorLogEntry title={t('server_error')}>
          {t('too_recently_compiled')}
        </ErrorLogEntry>
      )

    case 'terminated':
      return (
        <ErrorLogEntry title={t('terminated')}>
          {t('compile_terminated_by_user')}
        </ErrorLogEntry>
      )

    case 'rate-limited':
      return (
        <ErrorLogEntry title={t('pdf_compile_rate_limit_hit')}>
          {t('project_flagged_too_many_compiles')}
        </ErrorLogEntry>
      )

    case 'compile-in-progress':
      return (
        <ErrorLogEntry title={t('pdf_compile_in_progress_error')}>
          {t('pdf_compile_try_again')}
        </ErrorLogEntry>
      )

    case 'auto-compile-disabled':
      return (
        <ErrorLogEntry title={t('autocompile_disabled')}>
          {t('autocompile_disabled_reason')}
        </ErrorLogEntry>
      )

    case 'project-too-large':
      return (
        <ErrorLogEntry title={t('project_too_large')}>
          {t('project_too_much_editable_text')}
        </ErrorLogEntry>
      )

    case 'timedout':
      return (
        <ErrorLogEntry title={t('timedout')}>
          {t('proj_timed_out_reason')}

          <div>
            <a
              href="https://www.overleaf.com/learn/how-to/Why_do_I_keep_getting_the_compile_timeout_error_message%3F"
              target="_blank"
              rel="noopener"
            >
              {t('learn_how_to_make_documents_compile_quickly')}
            </a>
          </div>
        </ErrorLogEntry>
      )

    case 'failure':
      return (
        <ErrorLogEntry title={t('no_pdf_error_title')}>
          {t('no_pdf_error_explanation')}

          <ul className="log-entry-formatted-content-list">
            <li>{t('no_pdf_error_reason_unrecoverable_error')}</li>
            <li>
              <Trans
                i18nKey="no_pdf_error_reason_no_content"
                components={{ code: <code /> }}
              />
            </li>
            <li>
              <Trans
                i18nKey="no_pdf_error_reason_output_pdf_already_exists"
                components={{ code: <code /> }}
              />
            </li>
          </ul>
        </ErrorLogEntry>
      )

    case 'clear-cache':
      return (
        <ErrorLogEntry title={t('server_error')}>
          {t('somthing_went_wrong_compiling')}
        </ErrorLogEntry>
      )

    case 'validation-problems':
      return null // handled elsewhere

    case 'error':
    default:
      return (
        <ErrorLogEntry title={t('server_error')}>
          {t('somthing_went_wrong_compiling')}
        </ErrorLogEntry>
      )
  }
}

PdfPreviewError.propTypes = {
  error: PropTypes.string.isRequired,
}

export default memo(PdfPreviewError)

function ErrorLogEntry({ title, children }) {
  const { t } = useTranslation()

  return (
    <PdfLogEntry
      headerTitle={title}
      formattedContent={children}
      entryAriaLabel={t('compile_error_entry_description')}
      level="error"
    />
  )
}

ErrorLogEntry.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.any.isRequired,
}
