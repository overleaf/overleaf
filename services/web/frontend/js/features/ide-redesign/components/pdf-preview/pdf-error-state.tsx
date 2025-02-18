import OLButton from '@/features/ui/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { useRailContext } from '../../contexts/rail-context'
import { usePdfPreviewContext } from '@/features/pdf-preview/components/pdf-preview-provider'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function PdfErrorState() {
  const { loadingError } = usePdfPreviewContext()
  // TODO ide-redesign-cleanup: rename showLogs to something else and check usages
  const { showLogs } = useCompileContext()
  const { t } = useTranslation()
  const { setSelectedTab: setSelectedRailTab } = useRailContext()
  const newEditor = useFeatureFlag('editor-redesign')

  if (!newEditor || (!loadingError && !showLogs)) {
    return null
  }

  return (
    <div className="pdf-error-state">
      <div className="pdf-error-state-top-section">
        <div className="pdf-error-state-warning-icon">
          <MaterialIcon type="warning" />
        </div>
        <div className="pdf-error-state-text">
          <p className="pdf-error-state-label">{t('pdf_couldnt_compile')}</p>
          <p className="pdf-error-state-description">
            {t('we_are_unable_to_generate_the_pdf_at_this_time')}
          </p>
        </div>
        <OLButton
          variant="secondary"
          size="sm"
          onClick={() => {
            setSelectedRailTab('errors')
          }}
        >
          {t('check_logs')}
        </OLButton>
      </div>
      <div className="pdf-error-state-info-box">
        <div className="pdf-error-state-info-box-title">
          <MaterialIcon type="info" unfilled />
          {t('why_might_this_happen')}
        </div>
        <ul className="pdf-error-state-info-box-text">
          <li>{t('there_is_an_unrecoverable_latex_error')}</li>
          <li>{t('the_document_environment_contains_no_content')}</li>
          <li>{t('this_project_contains_a_file_called_output')}</li>
        </ul>
      </div>
    </div>
  )
}

export default PdfErrorState
