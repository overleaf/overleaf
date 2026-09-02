import { Trans, useTranslation } from 'react-i18next'
import { ErrorBoundaryFallback } from '../../../shared/components/error-boundary-fallback'

function PdfPreviewErrorBoundaryFallback({
  type,
}: {
  type: 'preview' | 'pdf' | 'logs'
}) {
  const { t } = useTranslation()

  const showInfoLink = (
    <Trans
      i18nKey="try_recompile_project_or_troubleshoot"
      components={[
        // eslint-disable-next-line jsx-a11y/anchor-has-content
        <a
          href="https://docs.overleaf.com/troubleshooting-and-support/resolving-pdf-rendering-and-project-loading-problems"
          target="_blank"
          rel="noopener noreferrer"
          key="troubleshooting-link"
        />,
      ]}
    />
  )

  switch (type) {
    case 'pdf':
      return (
        <ErrorBoundaryFallback>
          <p>{t('pdf_viewer_error')}</p>
          <p>{showInfoLink}</p>
        </ErrorBoundaryFallback>
      )

    case 'logs':
      return (
        <ErrorBoundaryFallback>
          <p>{t('log_viewer_error')}</p>
          <p>{showInfoLink}</p>
        </ErrorBoundaryFallback>
      )

    case 'preview':
    default:
      return (
        <ErrorBoundaryFallback>
          <p>{t('pdf_preview_error')}</p>
          <p>{showInfoLink}</p>
        </ErrorBoundaryFallback>
      )
  }
}

export default PdfPreviewErrorBoundaryFallback
