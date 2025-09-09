import { Trans, useTranslation } from 'react-i18next'
import ErrorState, { CheckLogsButton } from './error-state'
import MaterialIcon from '@/shared/components/material-icon'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'

export default function GeneralErrorState() {
  const { logEntries } = useCompileContext()
  const hasErrors = (logEntries?.errors?.length || 0) > 0

  if (hasErrors) {
    return <GeneralErrorStateWithErrors />
  }

  return <GeneralErrorStateWithoutErrors />
}

function GeneralErrorStateWithErrors() {
  const { t } = useTranslation()

  return (
    <ErrorState
      title={t('you_have_errors_the_pdf_couldnt_compile')}
      actions={<CheckLogsButton />}
    />
  )
}

function GeneralErrorStateWithoutErrors() {
  const { t } = useTranslation()

  return (
    <ErrorState
      title={t('pdf_couldnt_compile')}
      actions={<CheckLogsButton />}
      extraContent={
        <div className="pdf-error-state-info-box">
          <div className="pdf-error-state-info-box-title">
            <MaterialIcon type="info" unfilled />
            {t('why_might_this_happen')}
          </div>
          <div className="pdf-error-state-info-box-text">
            <ul className="pdf-error-state-info-box-list">
              <li>{t('there_is_a_latex_error_check_logs')}</li>
              <li>
                <Trans
                  i18nKey="the_document_environment_contains_no_content_learn_about_environments"
                  components={[
                    /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
                    <a
                      href="/learn/latex/Environments"
                      target="_blank"
                      rel="noopener noreferrer"
                    />,
                  ]}
                />
              </li>
              <li>{t('this_project_contains_a_file_called_output_pdf')}</li>
            </ul>
          </div>
        </div>
      }
    />
  )
}
