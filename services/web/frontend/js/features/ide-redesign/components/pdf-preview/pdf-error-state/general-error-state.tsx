import { useTranslation } from 'react-i18next'
import ErrorState, { CheckLogsButton } from './error-state'
import MaterialIcon from '@/shared/components/material-icon'

export default function GeneralErrorState() {
  const { t } = useTranslation()

  return (
    <ErrorState
      title={t('pdf_couldnt_compile')}
      description={t('we_are_unable_to_generate_the_pdf_at_this_time')}
      actions={<CheckLogsButton />}
      extraContent={
        <div className="pdf-error-state-info-box">
          <div className="pdf-error-state-info-box-title">
            <MaterialIcon type="info" unfilled />
            {t('why_might_this_happen')}
          </div>
          <div className="pdf-error-state-info-box-text">
            <ul className="pdf-error-state-info-box-list">
              <li>{t('there_is_an_unrecoverable_latex_error_check_logs')}</li>
              <li>{t('the_document_environment_contains_no_content')}</li>
              <li>{t('this_project_contains_a_file_called_output')}</li>
            </ul>
          </div>
        </div>
      }
    />
  )
}
