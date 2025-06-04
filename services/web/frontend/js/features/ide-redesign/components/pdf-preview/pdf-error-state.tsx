import OLButton from '@/features/ui/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { useRailContext } from '../../contexts/rail-context'
import { usePdfPreviewContext } from '@/features/pdf-preview/components/pdf-preview-provider'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useIsNewEditorEnabled } from '../../utils/new-editor-utils'
import { upgradePlan } from '@/main/account-upgrade'
import classNames from 'classnames'

function PdfErrorState() {
  const { loadingError } = usePdfPreviewContext()
  // TODO ide-redesign-cleanup: rename showLogs to something else and check usages
  const { hasShortCompileTimeout, error, showLogs } = useCompileContext()
  const newEditor = useIsNewEditorEnabled()

  if (!newEditor || (!loadingError && !showLogs)) {
    return null
  }

  if (hasShortCompileTimeout && error === 'timedout') {
    return <CompileTimeoutErrorState />
  }

  return <GeneralErrorState />
}

const GeneralErrorState = () => {
  const { t } = useTranslation()
  const { openTab: openRailTab } = useRailContext()

  return (
    <ErrorState
      title={t('pdf_couldnt_compile')}
      description={t('we_are_unable_to_generate_the_pdf_at_this_time')}
      iconType="warning"
      iconClassName="pdf-error-state-warning-icon"
      actions={
        <OLButton
          variant="secondary"
          size="sm"
          onClick={() => {
            openRailTab('errors')
          }}
        >
          {t('check_logs')}
        </OLButton>
      }
      extraContent={
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
      }
    />
  )
}

const CompileTimeoutErrorState = () => {
  const { t } = useTranslation()

  return (
    <ErrorState
      title={t('compile_limit_reached')}
      description={t('compile_limit_upgrade_prompt')}
      iconType="running_with_errors"
      actions={
        <OLButton
          variant="premium"
          size="sm"
          onClick={() => upgradePlan('compile-timeout')}
        >
          {t('upgrade')}
        </OLButton>
      }
    />
  )
}

const ErrorState = ({
  title,
  description,
  iconType,
  actions,
  iconClassName,
  extraContent,
}: {
  title: string
  description: string
  iconType: string
  actions: React.ReactNode
  iconClassName?: string
  extraContent?: React.ReactNode
}) => {
  return (
    <div className="pdf-error-state">
      <div className="pdf-error-state-top-section">
        <div className={classNames('pdf-error-state-icon', iconClassName)}>
          <MaterialIcon type={iconType} />
        </div>
        <div className="pdf-error-state-text">
          <p className="pdf-error-state-label">{title}</p>
          <p className="pdf-error-state-description">{description}</p>
        </div>
        {actions}
      </div>
      {extraContent}
    </div>
  )
}
export default PdfErrorState
